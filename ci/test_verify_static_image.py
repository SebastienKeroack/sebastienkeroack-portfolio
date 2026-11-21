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


def image_fixture(destination, *, missing=None, architecture="amd64", incomplete_archive=False):
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

    if missing in lower:
        del lower[missing]
    if missing in upper:
        del upper[missing]

    return write_archive(destination, lower, upper, architecture, incomplete_archive)


def write_archive(destination, lower, upper, architecture="amd64", incomplete_archive=False):
    archive = {"oci-layout": b'{"imageLayoutVersion":"1.0.0"}'}

    def blob(media_type, data):
        if isinstance(data, dict):
            data = json.dumps(data).encode()
        digest = hashlib.sha256(data).hexdigest()
        archive[f"blobs/sha256/{digest}"] = data
        return {"mediaType": OCI + media_type, "size": len(data), "digest": "sha256:" + digest}

    layers = [tar_bytes(lower), tar_bytes(upper)]
    config = blob("config.v1+json", {
        "architecture": architecture,
        "os": "linux",
        "config": {
            "User": "65532:65532",
            "Entrypoint": ["/usr/sbin/nginx"],
            "ExposedPorts": {"8080/tcp": {}},
        },
        "rootfs": {
            "type": "layers",
            "diff_ids": ["sha256:" + hashlib.sha256(layer).hexdigest() for layer in layers],
        },
    })
    descriptors = [
        blob("layer.v1.tar", layers[0]),
        blob("layer.v1.tar+gzip", gzip.compress(layers[1])),
    ]
    manifest = blob("manifest.v1+json", {
        "schemaVersion": 2,
        "mediaType": OCI + "manifest.v1+json",
        "config": config,
        "layers": descriptors,
    })
    if incomplete_archive:
        _, digest = descriptors[-1]["digest"].split(":")
        del archive[f"blobs/sha256/{digest}"]
    index = {"schemaVersion": 2, "manifests": [manifest]}
    archive["index.json"] = json.dumps(index).encode()
    destination.write_bytes(tar_bytes(archive, ("blobs", "blobs/sha256")))
    return manifest["digest"]


class VerifyStaticImage(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.archive = Path(scratch.name) / "static.oci.tar"
        self.policy = Path(scratch.name) / "policy.json"
        self.policy.write_text('{"default":[{"type":"insecureAcceptAnything"}]}')

    def verify(self, digest):
        return subprocess.run(
            [sys.executable, "-B", str(CI / "verify_static_image.py"), str(self.archive),
             "--expected-manifest-digest", digest, "--policy", str(self.policy)],
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
        self.assertIn("etc/nginx/nginx.conf", result.stderr)

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

    def test_refuses_archive_missing_a_layer(self):
        digest = image_fixture(self.archive, incomplete_archive=True)
        result = self.verify(digest)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("expected one regular archive member blobs/sha256/", result.stderr)


if __name__ == "__main__":
    unittest.main()
