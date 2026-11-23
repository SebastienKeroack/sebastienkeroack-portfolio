import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

if __package__:
    from . import verify_static_image
else:
    import verify_static_image


CI = Path(__file__).resolve().parent
WEB = "var/www/public_html/"
OCI = "application/vnd.oci.image."
PHOTO = b"fixture photo"
PHOTO_PATH = f"assets/{hashlib.sha256(PHOTO).hexdigest()[:8]}.jpeg"
PAGES = {
    "about.html": ("SOFTWARE DEVELOPER", "DÉVELOPPEUR LOGICIEL"),
    "404.html": (
        "Sorry, the page you are looking for could not be found!",
        "Désolé, la page que vous recherchez est introuvable!",
    ),
    "experience/experience.html": ("Professional experience", "Expérience professionnelle"),
    "projects/projects.html": ("Personal projects", "Projets personnels"),
    "contact/contact.html": ("Contact", "Contact"),
}


def tar_bytes(files, directories=()):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as archive:
        for name in directories:
            entry = tarfile.TarInfo(name)
            entry.type = tarfile.DIRTYPE
            entry.mode = 0o755
            archive.addfile(entry)
        for name, data in files.items():
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
    return output.getvalue()


def fixture_layers(missing=None):
    def page(lang, body, head=""):
        return (f'<html lang="{lang}"><head><title>Portfolio</title>{head}</head>'
                f'<body>{body}</body></html>').encode()

    old_php = WEB + "en/contact/contact-form-submit.php"
    lower = {
        old_php: b"retired fixture file",
        "etc/nginx/nginx.conf": b"# superseded fixture config\n",
        WEB + "index.html": page("en", ""),
        WEB + "404.html": page("en", ""),
        WEB + "favicon.ico": b"fixture icon",
        WEB + "favicon.svg": b"<svg></svg>",
        WEB + "assets/example.min.css": b"body {}",
        WEB + "assets/example.min.js": b"export {};",
        WEB + PHOTO_PATH: PHOTO,
    }
    upper = {
        WEB + "en/contact/.wh.contact-form-submit.php": b"",
        "etc/nginx/nginx.conf": (CI / "nginx/static.conf").read_bytes(),
        "etc/nginx/http.conf": (CI / "nginx/http.conf").read_bytes(),
        "etc/nginx/server.conf": (CI / "nginx/server.conf").read_bytes(),
    }
    for index, lang in enumerate(("en", "fr")):
        for name, titles in PAGES.items():
            heading = f"<h1>{titles[index]}</h1>"
            if name == "about.html":
                heading = f'<h1>Portfolio</h1><h2>{titles[index]}</h2><img src="/{PHOTO_PATH}">'
            if name == "contact/contact.html":
                heading += '<form id="contact-form"></form>'
            head = ('<link rel="stylesheet" href="/assets/example.min.css">'
                    '<script src="/assets/example.min.js"></script>')
            upper[WEB + f"{lang}/{name}"] = page(
                lang, f"<header></header><main>{heading}</main><footer></footer>", head
            )

    if missing in upper:
        del upper[missing]
    elif missing in lower:
        del lower[missing]

    return lower, upper


class Archive:
    def __init__(self):
        self.files = {"oci-layout": b'{"imageLayoutVersion":"1.0.0"}'}

    def blob(self, media_type, data):
        if isinstance(data, dict):
            data = json.dumps(data).encode()
        digest = hashlib.sha256(data).hexdigest()
        self.files[f"blobs/sha256/{digest}"] = data
        return {"mediaType": OCI + media_type, "size": len(data), "digest": "sha256:" + digest}

    def image(self, lower, upper, *, architecture="amd64", incomplete_archive=False,
              missing_diff_id=False, annotation=None):
        layers = [tar_bytes(lower), tar_bytes(upper)]
        diff_ids = ["sha256:" + hashlib.sha256(layer).hexdigest() for layer in layers]
        if missing_diff_id:
            diff_ids.pop()
        config = self.blob("config.v1+json", {
            "architecture": architecture,
            "os": "linux",
            "config": {
                "User": "65532:65532",
                "Entrypoint": ["/usr/sbin/nginx"],
                "ExposedPorts": {"8080/tcp": {}},
            },
            "rootfs": {"type": "layers", "diff_ids": diff_ids},
        })
        descriptors = [
            self.blob("layer.v1.tar", layers[0]),
            self.blob("layer.v1.tar+gzip", gzip.compress(layers[1], mtime=0)),
        ]
        image = {
            "schemaVersion": 2,
            "mediaType": OCI + "manifest.v1+json",
            "config": config,
            "layers": descriptors,
        }
        if annotation:
            image["annotations"] = {"org.opencontainers.image.title": annotation}
        if incomplete_archive:
            del self.files["blobs/sha256/" + descriptors[-1]["digest"][7:]]
        return self.blob("manifest.v1+json", image)

    def write(self, destination, *manifests):
        self.files["index.json"] = json.dumps({"schemaVersion": 2, "manifests": manifests}).encode()
        destination.write_bytes(tar_bytes(self.files, ("blobs", "blobs/sha256")))


def image_fixture(destination, *, missing=None, extra_manifest=False, stale_manifest_size=False,
                  **options):
    archive = Archive()
    layers = fixture_layers(missing)
    manifest = archive.image(*layers, **options)
    if stale_manifest_size:
        manifest["size"] += 1
    manifests = [manifest]
    if extra_manifest:
        other = archive.image(*layers, annotation="Other fixture image")
        reference = "org.opencontainers.image.ref.name"
        manifest["annotations"] = {reference: "static"}
        other["annotations"] = {reference: "other"}
        manifests.append(other)
    archive.write(destination, *manifests)
    return manifest["digest"]


def index_fixture(destination, *, platforms=("arm64", "amd64"), missing=None,
                  configs=None, parent_error=None, missing_manifest=None):
    archive = Archive()
    children = []
    for architecture in platforms:
        child = archive.image(*fixture_layers((missing or {}).get(architecture)),
                              architecture=(configs or {}).get(architecture, architecture))
        child["platform"] = {"os": "linux", "architecture": architecture}
        if architecture == "arm64":
            child["platform"]["variant"] = "v8"
        if architecture == missing_manifest:
            del archive.files["blobs/sha256/" + child["digest"][7:]]
        children.append(child)
    root = archive.blob("index.v1+json", {
        "schemaVersion": 2, "mediaType": OCI + "index.v1+json", "manifests": children,
    })
    if parent_error == "digest":
        location = "blobs/sha256/" + root["digest"][7:]
        archive.files[location] = archive.files[location].replace(b'"schemaVersion": 2', b'"schemaVersion" :2')
    elif parent_error == "size":
        root["size"] += 1
    archive.write(destination, root)
    return root["digest"], {
        "linux/" + member["platform"]["architecture"]: member["digest"] for member in children
    }


class VerifyStaticImage(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.archive = Path(scratch.name) / "static.oci.tar"
        self.policy = Path(scratch.name) / "policy.json"
        self.policy.write_text('{"default":[{"type":"insecureAcceptAnything"}]}')

    def verify(self, digest, *, index=False):
        expected = "--expected-index-digest" if index else "--expected-manifest-digest"
        return subprocess.run(
            [sys.executable, "-B", str(CI / "verify_static_image.py"), str(self.archive),
             expected, digest, "--policy", str(self.policy)],
            capture_output=True, text=True, check=False,
        )

    def test_reports_archive_and_effective_files(self):
        digest = image_fixture(self.archive)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout, "the CLI must emit archive and filesystem evidence")
        evidence = json.loads(result.stdout)
        self.assertEqual(evidence["manifest_digest"], digest)
        self.assertEqual(evidence["archive_sha256"], hashlib.sha256(self.archive.read_bytes()).hexdigest())
        self.assertEqual(evidence["platform"], "linux/amd64")
        self.assertIn("/" + WEB + "fr/projects/projects.html", evidence["files_sha256"])
        self.assertEqual(evidence["files_sha256"]["/" + WEB + PHOTO_PATH], hashlib.sha256(PHOTO).hexdigest())

    def test_refuses_missing_french_projects(self):
        digest = image_fixture(self.archive, missing=WEB + "fr/projects/projects.html")
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("fr/projects/projects.html", result.stderr)

    def test_refuses_missing_referenced_image(self):
        digest = image_fixture(self.archive, missing=WEB + PHOTO_PATH)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn(PHOTO_PATH, result.stderr)

    def test_refuses_superseded_nginx_config(self):
        digest = image_fixture(self.archive, missing="etc/nginx/nginx.conf")
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("/etc/nginx/nginx.conf differs from ci/nginx/static.conf", result.stderr)

    def test_refuses_php_left_in_effective_root(self):
        digest = image_fixture(self.archive, missing=WEB + "en/contact/.wh.contact-form-submit.php")
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("en/contact/contact-form-submit.php", result.stderr)

    def test_refuses_different_manifest_digest(self):
        image_fixture(self.archive)
        result = self.verify("sha256:" + "0" * 64)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("manifest digest", result.stderr)

    def test_refuses_different_platform(self):
        digest = image_fixture(self.archive, architecture="arm64")
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("linux/amd64", result.stderr)

    def test_refuses_two_index_manifests(self):
        digest = image_fixture(self.archive, extra_manifest=True)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected exactly one OCI image manifest", result.stderr)

    def test_refuses_stale_archive_manifest_size(self):
        digest = image_fixture(self.archive, stale_manifest_size=True)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("manifest size mismatch with the archive descriptor", result.stderr)

    def test_refuses_layer_without_diff_id(self):
        digest = image_fixture(self.archive, missing_diff_id=True)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected one rootfs diff ID per layer", result.stderr)

    def test_refuses_archive_missing_a_layer(self):
        digest = image_fixture(self.archive, incomplete_archive=True)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("skopeo failed:", result.stderr)
        self.assertIn("no such file or directory", result.stderr)

    def test_reports_root_digest_and_each_child_by_platform_in_either_order(self):
        for platforms in (("arm64", "amd64"), ("amd64", "arm64")):
            with self.subTest(platforms=platforms):
                digest, children = index_fixture(self.archive, platforms=platforms)
                result = self.verify(digest, index=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                evidence = json.loads(result.stdout)
                self.assertEqual(evidence["index_digest"], digest)
                self.assertEqual(evidence["archive_sha256"],
                                 hashlib.sha256(self.archive.read_bytes()).hexdigest())
                self.assertEqual(set(evidence["platforms"]), set(children))
                for platform, child_digest in children.items():
                    child = evidence["platforms"][platform]
                    self.assertEqual(child["manifest_digest"], child_digest)
                    self.assertIn("/" + WEB + "fr/projects/projects.html", child["files_sha256"])
                    self.assertEqual(child["files_sha256"]["/" + WEB + PHOTO_PATH],
                                     hashlib.sha256(PHOTO).hexdigest())

    def test_refuses_missing_static_content_or_php_in_either_child(self):
        for architecture in ("amd64", "arm64"):
            for missing, message in (
                (WEB + "fr/projects/projects.html", "fr/projects/projects.html"),
                (WEB + "en/contact/.wh.contact-form-submit.php", "unexpected PHP path"),
            ):
                with self.subTest(architecture=architecture, missing=missing):
                    digest, _ = index_fixture(self.archive, missing={architecture: missing})
                    result = self.verify(digest, index=True)
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertIn(message, result.stderr)

    def test_refuses_incomplete_duplicate_or_extra_platform_sets(self):
        for platforms in (("amd64",), ("amd64", "amd64"), ("arm64", "amd64", "ppc64le")):
            with self.subTest(platforms=platforms):
                digest, _ = index_fixture(self.archive, platforms=platforms)
                result = self.verify(digest, index=True)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("one OCI manifest each for linux/amd64 and linux/arm64", result.stderr)

    def test_refuses_platform_config_conflict(self):
        digest, _ = index_fixture(self.archive, configs={"arm64": "amd64"})
        result = self.verify(digest, index=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected linux/arm64", result.stderr)

    def test_refuses_an_unexpected_index_digest(self):
        index_fixture(self.archive)
        result = self.verify("sha256:" + "0" * 64, index=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("index digest mismatch", result.stderr)

    def test_refuses_a_different_native_copy_digest(self):
        digest, children = index_fixture(self.archive)
        copy = verify_static_image.native

        def substitute_digest(*command):
            copy(*command)
            if command[0] == "skopeo" and command[command.index("--override-arch") + 1] == "arm64":
                destination = Path(command[command.index("--digestfile") + 1])
                destination.write_text(children["linux/amd64"])

        arguments = ["verify_static_image.py", str(self.archive),
                     "--expected-index-digest", digest, "--policy", str(self.policy)]
        with (patch("sys.argv", arguments), patch.object(verify_static_image, "native", substitute_digest),
              patch("sys.stderr", new_callable=io.StringIO) as stderr):
            self.assertEqual(verify_static_image.main(), 1, stderr.getvalue())
            self.assertIn("linux/arm64 copy selected a different manifest digest", stderr.getvalue())

    def test_refuses_root_bytes_that_disagree_with_the_layout_descriptor(self):
        for error in ("digest", "size"):
            with self.subTest(error=error):
                digest, _ = index_fixture(self.archive, parent_error=error)
                result = self.verify(digest, index=True)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn(f"index {error} mismatch", result.stderr)

    def test_refuses_a_missing_child_manifest(self):
        digest, _ = index_fixture(self.archive, missing_manifest="arm64")
        result = self.verify(digest, index=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected one regular archive member blobs/sha256/", result.stderr)

    def test_refuses_wrong_root_type_in_either_mode(self):
        digest = image_fixture(self.archive)
        result = self.verify(digest, index=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected exactly one OCI image index", result.stderr)
        digest, _ = index_fixture(self.archive)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected exactly one OCI image manifest", result.stderr)


if __name__ == "__main__":
    unittest.main()
