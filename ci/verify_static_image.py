# Native gap: OCI tools unpack the image but cannot check the portfolio's file contract.

import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import unquote, urljoin, urlsplit


OCI = "application/vnd.oci.image."
SHA256 = re.compile(r"sha256:[0-9a-f]{64}")
WEB_ROOT = "var/www/public_html"
HOST = "sebastienkeroack.com"
LOCALIZED_PAGES = {
    "about.html": ("h2", "SOFTWARE DEVELOPER", "DÉVELOPPEUR LOGICIEL"),
    "404.html": (
        "h1",
        "Sorry, the page you are looking for could not be found!",
        "Désolé, la page que vous recherchez est introuvable!",
    ),
    "experience/experience.html": ("h1", "Professional experience", "Expérience professionnelle"),
    "projects/projects.html": ("h1", "Personal projects", "Projets personnels"),
    "contact/contact.html": ("h1", "Contact", "Contact"),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(stream):
    return hashlib.file_digest(stream, "sha256").hexdigest()


def archive_manifest(path, expected):
    with tarfile.open(path, "r:") as archive:
        def metadata(name):
            matches = [entry for entry in archive.getmembers()
                       if entry.name.removeprefix("./") == name]
            require(len(matches) == 1 and matches[0].isfile(),
                    f"expected one regular archive member {name}")
            with archive.extractfile(matches[0]) as stream:
                return json.load(stream)

        require(metadata("oci-layout")["imageLayoutVersion"] == "1.0.0",
                "expected OCI image layout version 1.0.0")
        index = metadata("index.json")
    manifests = index["manifests"]
    require(index["schemaVersion"] == 2 and len(manifests) == 1
            and manifests[0]["mediaType"] == OCI + "manifest.v1+json",
            "expected exactly one OCI image manifest")
    descriptor = manifests[0]
    require(descriptor["digest"] == expected,
            f"manifest digest mismatch: expected {expected}, found {descriptor['digest']}")
    return descriptor


def verify_config(layout, descriptor):
    blobs = layout / "blobs/sha256"
    raw_manifest = (blobs / descriptor["digest"][7:]).read_bytes()
    # Skopeo writes the actual manifest size into the new index.
    require(len(raw_manifest) == descriptor["size"], "manifest size mismatch with the archive descriptor")
    manifest = json.loads(raw_manifest)
    require(manifest["schemaVersion"] == 2
            and manifest.get("mediaType", OCI + "manifest.v1+json") == OCI + "manifest.v1+json",
            "expected an OCI image manifest")
    config_descriptor = manifest["config"]
    require(config_descriptor["mediaType"] == OCI + "config.v1+json", "expected an OCI image config")
    digest = config_descriptor["digest"]
    require(SHA256.fullmatch(digest), "expected a SHA-256 config digest")
    config = json.loads((blobs / digest[7:]).read_bytes())
    for platform in (descriptor.get("platform", config), config):
        require((platform.get("os"), platform.get("architecture")) == ("linux", "amd64"),
                "expected linux/amd64")
    runtime = config["config"]
    require(runtime.get("User") == "65532:65532", "expected OCI user 65532:65532")
    require(runtime.get("Entrypoint") == ["/usr/sbin/nginx"], "expected the Nginx entrypoint")
    require("8080/tcp" in runtime.get("ExposedPorts", {}), "expected OCI port 8080/tcp")

    layers = manifest["layers"]
    require(len(layers) == len(config["rootfs"]["diff_ids"]) > 0,
            "expected one rootfs diff ID per layer")
    for layer in layers:
        media_type = layer["mediaType"]
        require(media_type in (OCI + "layer.v1.tar", OCI + "layer.v1.tar+gzip"),
                f"unsupported OCI layer media type: {media_type}")


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = set()
        self.language = None
        self.contact_form = False
        self.unresolved_include = False
        self.headings = {"h1": set(), "h2": set()}
        self.heading = None
        self.heading_text = []
        self.inline_module = False
        self.assets = set()
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attributes):
        self.tags.add(tag)
        attrs = dict(attributes)
        if tag == "html":
            self.language = attrs.get("lang")
        if tag == "form" and attrs.get("id") == "contact-form":
            self.contact_form = True
        if tag in self.headings:
            self.heading, self.heading_text = tag, []
        if tag == "script":
            self.inline_module = attrs.get("type") == "module" and "src" not in attrs

        reference = None
        if tag in ("img", "script"):
            reference = attrs.get("src")
        elif tag == "link" and attrs.get("rel") in ("stylesheet", "icon", "apple-touch-icon"):
            reference = attrs.get("href")
        elif tag == "meta" and attrs.get("property") == "og:image":
            reference = attrs.get("content")
        if reference:
            self.assets.add(reference)

    def handle_endtag(self, tag):
        if tag == self.heading:
            self.headings[tag].add(" ".join("".join(self.heading_text).split()))
            self.heading = None
        if tag == "script":
            self.inline_module = False

    def handle_data(self, data):
        if self.heading:
            self.heading_text.append(data)
        if self.inline_module:
            for match in re.finditer(r"""\bfrom\s*(["'])([^"']+)\1""", data):
                self.assets.add(match[2])

    def handle_comment(self, comment):
        if comment.lstrip().startswith("#include"):
            self.unresolved_include = True


def image_path(root, name):
    parts = Path(name).parts
    require(parts and not Path(name).is_absolute() and ".." not in parts,
            f"expected a path inside the image: {name}")
    for part in parts:
        root = root / part
        require(not root.is_symlink(), f"unexpected symlink in image path: {name}")
    return root


def walk_error(error):
    raise error


def verify_files(root):
    evidence = {}

    def observed(name):
        path = image_path(root, name)
        require(path.is_file() and path.stat().st_size > 0, f"missing or empty image file: /{name}")
        return path

    def record(name):
        if "/" + name not in evidence:
            with observed(name).open("rb") as stream:
                evidence["/" + name] = sha256(stream)
        return evidence["/" + name]

    web = image_path(root, WEB_ROOT)
    require(web.is_dir(), f"missing web root: /{WEB_ROOT}")
    for directory, subdirectories, files in os.walk(web, onerror=walk_error):
        for name in subdirectories + files:
            path = Path(directory) / name
            require(not path.is_symlink(), f"unexpected symlink in web root: /{path.relative_to(root)}")
            require(not name.lower().endswith(".php"), f"unexpected PHP path: /{path.relative_to(root)}")
    require(not image_path(root, "var/www/core/php").exists(), "unexpected PHP tree: /var/www/core/php")

    for icon in ("favicon.ico", "favicon.svg"):
        record(f"{WEB_ROOT}/{icon}")
    pages = {"index.html": ("en", None), "404.html": ("en", None)}
    for lang, column in (("en", 1), ("fr", 2)):
        for name, headings in LOCALIZED_PAGES.items():
            pages[f"{lang}/{name}"] = (lang, (headings[0], headings[column]))

    for name, (lang, heading) in pages.items():
        image_name = f"{WEB_ROOT}/{name}"
        html = observed(image_name).read_bytes()
        evidence["/" + image_name] = hashlib.sha256(html).hexdigest()
        page = Page(html.decode("utf-8"))
        require(page.language == lang and {"html", "head", "title", "body"} <= page.tags
                and not page.unresolved_include, f"expected built {lang} HTML: /{image_name}")
        assets = set()
        for reference in sorted(page.assets):
            url = urlsplit(urljoin(f"https://{HOST}/{name}", reference))
            if url.scheme in ("http", "https") and url.hostname == HOST:
                asset = unquote(url.path).lstrip("/")
                digest = record(f"{WEB_ROOT}/{asset}")
                if asset.endswith(".jpeg"):
                    require(Path(asset).stem == digest[:8], f"JPEG name does not match its bytes: /{asset}")
                assets.add(asset)
        if heading:
            tag, text = heading
            require({"header", "main", "h1", "footer"} <= page.tags and text in page.headings[tag],
                    f"expected localized page structure and heading {text!r}: /{image_name}")
            require(any(asset.endswith(".min.css") for asset in assets)
                    and any(asset.endswith((".min.js", ".min.mjs")) for asset in assets),
                    f"expected local minified CSS and JavaScript: /{image_name}")
        if name.endswith("/about.html"):
            require(any(asset.endswith(".jpeg") for asset in assets),
                    f"expected a local hashed JPEG: /{image_name}")
        if name.endswith("/contact/contact.html"):
            require(page.contact_form, f"expected the contact form: /{image_name}")

    configs = Path(__file__).resolve().parent / "nginx"
    for source, installed in (("static.conf", "nginx.conf"), ("http.conf", "http.conf"),
                              ("server.conf", "server.conf")):
        name = "etc/nginx/" + installed
        require(record(name) == hashlib.sha256((configs / source).read_bytes()).hexdigest(),
                f"/{name} differs from ci/nginx/{source}")
    return evidence


def native(*command):
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    require(result.returncode == 0,
            f"{command[0]} failed: {result.stderr.strip() or result.stdout.strip() or result.returncode}")


def main():
    parser = argparse.ArgumentParser(description="Verify an offline portfolio static OCI archive.")
    parser.add_argument("archive", type=Path, help="path to static.oci.tar")
    parser.add_argument("--expected-manifest-digest", required=True, help="sha256 digest from the build")
    parser.add_argument("--policy", type=Path, required=True, help="containers/image policy for the local copy")
    args = parser.parse_args()
    digest = args.expected_manifest_digest
    try:
        require(SHA256.fullmatch(digest), "expected a sha256: manifest digest")
        with tempfile.TemporaryDirectory(prefix="portfolio-image-") as directory:
            work = Path(directory)
            archive = work / "static.oci.tar"
            # Hash and unpack the same snapshot even if the supplied path changes.
            shutil.copyfile(args.archive, archive)
            with archive.open("rb") as stream:
                archive_hash = sha256(stream)
            descriptor = archive_manifest(archive, digest)

            layout = work / "layout"
            image = f"{layout}:static"
            native("skopeo", "--tmpdir", directory, "--policy", str(args.policy),
                   "copy", "--quiet", "--preserve-digests",
                   "--dest-oci-accept-uncompressed-layers", f"oci-archive:{archive}", "oci:" + image)
            verify_config(layout, descriptor)
            bundle = work / "bundle"
            native("umoci", "unpack", "--rootless", "--image", image, str(bundle))
            evidence = verify_files(bundle / "rootfs")
        print(json.dumps({"archive_sha256": archive_hash, "manifest_digest": digest,
                          "platform": "linux/amd64", "files_sha256": evidence}, indent=2, sort_keys=True))
        return 0
    except (OSError, ValueError, TypeError, KeyError, AttributeError, EOFError, tarfile.TarError) as error:
        print(f"verify static image: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
