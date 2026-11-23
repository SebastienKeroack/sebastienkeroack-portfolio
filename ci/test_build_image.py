import hashlib
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import tarfile
import tempfile
import unittest

from .test_verify_static_image import index_fixture, tar_bytes


ROOT = Path(__file__).resolve().parents[1]
BUILDX = "/usr/local/lib/docker/cli-plugins/docker-buildx"
BUILD_FIXTURE = """#!/usr/bin/env bash
set -eu
if [[ $1 == create ]]; then
  exit 0
fi
[[ $1 == bake ]]
archive="$FIXTURE_FIRST"
for arg in "$@"; do
  case "$arg" in
    --no-cache) archive="$FIXTURE_REBUILD" ;;
    static.output=type=oci,dest=*) destination=${arg#*dest=}; destination=${destination%%,*} ;;
  esac
done
cp -- "$archive" "$destination"
"""


class BuildImage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        workflow = os.environ.get("PORTFOLIO_BUILD_WORKFLOW", ROOT / ".github/workflows/build-image.yaml")
        cls.step = subprocess.check_output(
            ["yq", "-r", '.jobs.build.steps[] | select(.id == "image") | .run', workflow],
            text=True,
        )

    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.directory = Path(scratch.name)
        self.first = self.directory / "first.tar"
        self.rebuild = self.directory / "rebuild.tar"
        self.output = self.directory / "github-output"
        self.digest, self.manifests = index_fixture(self.first)
        self.rebuild.write_bytes(self.first.read_bytes())
        buildx = self.directory / "buildx"
        buildx.write_text(BUILD_FIXTURE)
        buildx.chmod(0o700)
        self.assertIn(BUILDX, self.step)
        self.script = self.step.replace(BUILDX, shlex.quote(str(buildx)))

    def run_step(self):
        return subprocess.run(
            ["bash", "-s"], input=self.script, cwd=ROOT, capture_output=True, text=True, check=False,
            env={**os.environ, "RUNNER_TEMP": str(self.directory), "GITHUB_OUTPUT": str(self.output),
                 "GITHUB_WORKSPACE": str(ROOT), "BUILDKIT_HOST": "fixture",
                 "FIXTURE_FIRST": str(self.first), "FIXTURE_REBUILD": str(self.rebuild)},
        )

    def archive_members(self, path):
        with tarfile.open(path, "r:") as archive:
            return {entry.name: archive.extractfile(entry).read() for entry in archive if entry.isfile()}

    def replace_tar_member(self, path, name, replacements):
        files = self.archive_members(path)
        original = files.pop(name)
        with tarfile.open(path, "w") as archive:
            for entry_name, entry_type, data in replacements(original):
                entry = tarfile.TarInfo(entry_name)
                entry.type = entry_type
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
            for entry_name, data in files.items():
                entry = tarfile.TarInfo(entry_name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))

    def change_member(self, archive, platform, change):
        files = self.archive_members(archive)
        member = "blobs/sha256/" + self.manifests[platform].removeprefix("sha256:")
        payload = files.pop(member)
        changed = change(payload)
        if changed is not None:
            files[member] = changed
        archive.write_bytes(tar_bytes(files))
        other = self.first if archive == self.rebuild else self.rebuild
        parent = "blobs/sha256/" + self.digest.removeprefix("sha256:")
        self.assertEqual(files[parent], self.archive_members(other)[parent])
        self.assertEqual(files["index.json"], self.archive_members(other)["index.json"])

    def assert_refused(self, message):
        result = self.run_step()
        if self.output.exists():
            self.fail(f"workflow handed off a rejected export: {self.output.read_text().strip()}")
        self.assertEqual(result.returncode, 1, (result.stdout, result.stderr))
        self.assertIn(message, result.stderr)

    def test_handoff_with_complete_matching_exports(self):
        result = self.run_step()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"static {self.digest}\n", result.stdout)
        self.assertEqual(self.output.read_text(), f"archive={self.directory}/image/static.oci.tar\n")
        self.assertEqual((self.directory / "image/static.oci.tar").read_bytes(), self.first.read_bytes())

    def test_refuses_rebuild_with_a_different_valid_index(self):
        digest, _ = index_fixture(self.rebuild, platforms=("amd64", "arm64"))
        self.assertNotEqual(digest, self.digest)
        self.assert_refused("not reproducible")

    def test_refuses_first_export_missing_arm64_manifest_with_same_parent(self):
        self.change_member(self.first, "linux/arm64", lambda payload: None)
        self.assert_refused("static.oci.tar linux/arm64 manifest")

    def test_refuses_rebuild_with_truncated_arm64_manifest(self):
        self.change_member(self.rebuild, "linux/arm64", lambda payload: payload[:-1])
        self.assert_refused("again.oci.tar linux/arm64 manifest")

    def test_refuses_first_export_with_changed_amd64_bytes_at_same_size(self):
        self.change_member(self.first, "linux/amd64", lambda payload: payload[:-1] + b" ")
        self.assert_refused("static.oci.tar linux/amd64 manifest")

    def test_refuses_stale_size_for_an_otherwise_exact_manifest(self):
        files = self.archive_members(self.first)
        parent = "blobs/sha256/" + self.digest.removeprefix("sha256:")
        index = json.loads(files.pop(parent))
        child = next(member for member in index["manifests"] if member["platform"]["architecture"] == "arm64")
        child["size"] += 1
        raw = json.dumps(index).encode()
        digest = hashlib.sha256(raw).hexdigest()
        files["blobs/sha256/" + digest] = raw
        layout = json.loads(files["index.json"])
        layout["manifests"][0].update(digest="sha256:" + digest, size=len(raw))
        files["index.json"] = json.dumps(layout).encode()
        stale = tar_bytes(files)
        self.first.write_bytes(stale)
        self.rebuild.write_bytes(stale)
        self.assert_refused("static.oci.tar linux/arm64 manifest")

    def test_refuses_a_manifest_split_across_duplicate_tar_entries(self):
        member = "blobs/sha256/" + self.manifests["linux/arm64"].removeprefix("sha256:")
        self.replace_tar_member(self.first, member, lambda payload: (
            (member, tarfile.REGTYPE, payload[:1]),
            (member, tarfile.REGTYPE, payload[1:]),
        ))
        self.assert_refused("static.oci.tar linux/arm64 manifest")

    def test_refuses_layout_index_split_across_duplicate_members(self):
        self.replace_tar_member(self.first, "index.json", lambda payload: (
            ("index.json", tarfile.REGTYPE, payload[:1]),
            ("index.json", tarfile.REGTYPE, payload[1:]),
        ))
        self.assert_refused("static.oci.tar must hold one regular index.json")

    def test_refuses_duplicate_layout_index_under_dot_prefix_alias(self):
        self.replace_tar_member(self.first, "index.json", lambda payload: (
            ("index.json", tarfile.REGTYPE, payload),
            ("./index.json", tarfile.REGTYPE, payload),
        ))
        self.assert_refused("static.oci.tar must hold one regular index.json")

    def test_refuses_two_json_values_in_one_layout_index_member(self):
        self.replace_tar_member(self.rebuild, "index.json", lambda payload: (
            ("index.json", tarfile.REGTYPE, payload + b"\n{}"),
        ))
        self.assert_refused("again.oci.tar index.json must contain one JSON document")

    def test_refuses_an_object_instead_of_a_layout_manifest_array(self):
        def object_manifest(payload):
            layout = json.loads(payload)
            layout["manifests"] = {"entry": layout["manifests"][0]}
            return (("index.json", tarfile.REGTYPE, json.dumps(layout).encode()),)

        self.replace_tar_member(self.first, "index.json", object_manifest)
        self.assert_refused("static.oci.tar index.json must contain one JSON document")

    def test_refuses_a_single_nonregular_layout_index_member_with_intact_bytes(self):
        # GNU tar streams an unknown type's bytes as though it were a regular file.
        self.replace_tar_member(self.first, "index.json", lambda payload: (("index.json", b"Z", payload),))
        self.assert_refused("static.oci.tar must hold one regular index.json")

    def test_refuses_a_single_nonregular_child_member_with_intact_bytes(self):
        member = "blobs/sha256/" + self.manifests["linux/arm64"].removeprefix("sha256:")
        self.replace_tar_member(self.first, member, lambda payload: ((member, b"Z", payload),))
        self.assert_refused("static.oci.tar linux/arm64 manifest")
