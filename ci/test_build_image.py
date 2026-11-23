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
if [[ $1 == inspect ]]; then
  printf 'Name:            portfolio\\n'
  printf 'BuildKit version: v0.34.2\\n'
  exit 0
fi
[[ $1 == bake ]]
printf '%s\\n' "$*" >> "$FIXTURE_BAKE_LOG"
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
        self.bake_log = self.directory / "bake.log"
        self.digest, self.manifests = index_fixture(self.first)
        self.rebuild.write_bytes(self.first.read_bytes())
        buildx = self.directory / "buildx"
        buildx.write_text(BUILD_FIXTURE)
        buildx.chmod(0o700)
        self.assertIn(BUILDX, self.step)
        self.script = self.step.replace(BUILDX, shlex.quote(str(buildx)))

    def run_step(self, *, verify_reproducibility=False, extra_env=None):
        env = {
            **os.environ,
            "RUNNER_TEMP": str(self.directory),
            "GITHUB_OUTPUT": str(self.output),
            "GITHUB_WORKSPACE": str(ROOT),
            "GITHUB_REF": "refs/heads/main",
            "GITHUB_REPOSITORY": "SebastienKeroack/sebastienkeroack-portfolio",
            "BUILDKIT_HOST": "fixture",
            "FIXTURE_FIRST": str(self.first),
            "FIXTURE_REBUILD": str(self.rebuild),
            "FIXTURE_BAKE_LOG": str(self.bake_log),
            "VERIFY_REPRODUCIBILITY": "true" if verify_reproducibility else "false",
        }
        if extra_env:
            env.update(extra_env)
        return subprocess.run(
            ["bash", "-s"], input=self.script, cwd=ROOT, capture_output=True, text=True, check=False, env=env,
        )

    def archive_members(self, path):
        with tarfile.open(path, "r:") as archive:
            return {entry.name: archive.extractfile(entry).read() for entry in archive if entry.isfile()}

    def child_manifest(self, path, platform):
        files = self.archive_members(path)
        member = "blobs/sha256/" + self.manifests[platform].removeprefix("sha256:")
        return json.loads(files[member])

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

    def change_blob(self, archive, digest, change):
        files = self.archive_members(archive)
        member = "blobs/sha256/" + digest.removeprefix("sha256:")
        payload = files.pop(member)
        changed = change(payload)
        if changed is not None:
            files[member] = changed
        archive.write_bytes(tar_bytes(files))

    def change_member(self, archive, platform, change):
        self.change_blob(archive, self.manifests[platform], change)
        other = self.first if archive == self.rebuild else self.rebuild
        parent = "blobs/sha256/" + self.digest.removeprefix("sha256:")
        self.assertEqual(self.archive_members(archive)[parent], self.archive_members(other)[parent])
        self.assertEqual(self.archive_members(archive)["index.json"], self.archive_members(other)["index.json"])

    def change_parent(self, change):
        files = self.archive_members(self.first)
        parent = "blobs/sha256/" + self.digest.removeprefix("sha256:")
        raw = change(files.pop(parent))
        digest = hashlib.sha256(raw).hexdigest()
        files["blobs/sha256/" + digest] = raw
        layout = json.loads(files["index.json"])
        layout["manifests"][0].update(digest="sha256:" + digest, size=len(raw))
        files["index.json"] = json.dumps(layout).encode()
        archive = tar_bytes(files)
        self.first.write_bytes(archive)
        self.rebuild.write_bytes(archive)

    def assert_refused(self, message, *, verify_reproducibility=False):
        result = self.run_step(verify_reproducibility=verify_reproducibility)
        if self.output.exists():
            self.fail(f"workflow handed off a rejected export: {self.output.read_text().strip()}")
        self.assertEqual(result.returncode, 1, (result.stdout, result.stderr))
        self.assertIn(message, result.stderr)

    def test_single_build_handoff_emits_verified_archive_and_receipt(self):
        result = self.run_step()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"static {self.digest}\n", result.stdout)
        archive_path = self.directory / "image/static.oci.tar"
        receipt_path = self.directory / "image/images-receipt.json"
        self.assertEqual(
            self.output.read_text(),
            f"archive={archive_path}\nreceipt={receipt_path}\n",
        )
        self.assertEqual(archive_path.read_bytes(), self.first.read_bytes())
        bake_calls = self.bake_log.read_text().splitlines()
        self.assertEqual(len(bake_calls), 1, bake_calls)

        commit = subprocess.check_output(["git", "rev-parse", "--verify", "HEAD^{commit}"], cwd=ROOT, text=True).strip()
        receipt = json.loads(receipt_path.read_text())
        self.assertEqual(receipt["schema"], 1)
        self.assertEqual(receipt["source_commit"], commit)
        self.assertEqual(receipt["git_ref"], "refs/heads/main")
        self.assertEqual(receipt["images"]["static"], {
            "repository": "registry.mgmt.yqb1.keroack.internal:18443/sites/portfolio-static",
            "container_client": "remote",
            "source": "built",
            "published": False,
            "digest": None,
            "reference": None,
            "platforms": ["linux/amd64", "linux/arm64"],
        })
        self.assertEqual(receipt["export"], {
            "buildkit": "v0.34.2",
            "archives": {
                "static": {
                    "digest": self.digest,
                    "sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
                    "children": self.manifests,
                },
            },
        })

    def test_single_build_uses_explicit_harbor_layer_cache_when_configured(self):
        result = self.run_step(extra_env={
            "KEROACK_LAYER_CACHE_PROJECT": "registry.mgmt.yqb1.keroack.internal:18443/sites-build-cache",
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        bake_calls = self.bake_log.read_text().splitlines()
        self.assertEqual(len(bake_calls), 1, bake_calls)
        cache_hash = hashlib.sha256(b"static:refs/heads/main").hexdigest()
        expected_ref = (
            "registry.mgmt.yqb1.keroack.internal:18443/sites-build-cache/"
            f"sebastienkeroack/sebastienkeroack-portfolio/static:cache-v2-{cache_hash}"
        )
        self.assertIn(f"static.cache-from=type=registry,ref={expected_ref}", bake_calls[0])
        self.assertIn(f"static.cache-to=type=registry,ref={expected_ref},mode=max", bake_calls[0])

    def test_reproducibility_mode_runs_uncached_rebuild_and_hands_off_matching_exports(self):
        result = self.run_step(verify_reproducibility=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        bake_calls = self.bake_log.read_text().splitlines()
        self.assertEqual(len(bake_calls), 2, bake_calls)
        self.assertIn("--no-cache", bake_calls[1])
        self.assertFalse((self.directory / "image/again.oci.tar").exists())

    def test_refuses_rebuild_with_a_different_valid_index(self):
        digest, _ = index_fixture(self.rebuild, platforms=("amd64", "arm64"))
        self.assertNotEqual(digest, self.digest)
        self.assert_refused("not reproducible", verify_reproducibility=True)

    def test_refuses_first_export_missing_arm64_manifest_with_same_parent(self):
        self.change_member(self.first, "linux/arm64", lambda payload: None)
        self.assert_refused("static.oci.tar linux/arm64 manifest")

    def test_refuses_rebuild_with_truncated_arm64_manifest(self):
        self.change_member(self.rebuild, "linux/arm64", lambda payload: payload[:-1])
        self.assert_refused("again.oci.tar linux/arm64 manifest", verify_reproducibility=True)

    def test_refuses_first_export_with_changed_amd64_bytes_at_same_size(self):
        self.change_member(self.first, "linux/amd64", lambda payload: payload[:-1] + b" ")
        self.assert_refused("static.oci.tar linux/amd64 manifest")

    def test_refuses_missing_child_config_blob(self):
        config_digest = self.child_manifest(self.first, "linux/arm64")["config"]["digest"]
        self.change_blob(self.first, config_digest, lambda payload: None)
        self.assert_refused("static.oci.tar linux/arm64 config")

    def test_refuses_corrupted_child_config_blob(self):
        config_digest = self.child_manifest(self.first, "linux/amd64")["config"]["digest"]
        self.change_blob(self.first, config_digest, lambda payload: payload[:-1] + b" ")
        self.assert_refused("static.oci.tar linux/amd64 config")

    def test_refuses_child_config_platform_mismatch(self):
        # Give arm64 a distinct manifest (different missing file) whose config wrongly names amd64.
        digest, _ = index_fixture(
            self.first,
            configs={"arm64": "amd64"},
            missing={"arm64": "var/www/public_html/favicon.ico"},
        )
        self.digest = digest
        self.assert_refused("static.oci.tar linux/arm64 config")

    def test_refuses_duplicate_child_manifest_digests(self):
        digest, _ = index_fixture(self.first, configs={"arm64": "amd64"})
        self.digest = digest
        self.assert_refused("static.oci.tar must hold one OCI image manifest per Bake platform")

    def test_refuses_missing_child_layer_blob(self):
        layer_digest = self.child_manifest(self.first, "linux/arm64")["layers"][-1]["digest"]
        self.change_blob(self.first, layer_digest, lambda payload: None)
        self.assert_refused(f"static.oci.tar linux/arm64 layer {layer_digest}")

    def test_refuses_corrupted_child_layer_blob(self):
        layer_digest = self.child_manifest(self.first, "linux/amd64")["layers"][0]["digest"]
        self.change_blob(self.first, layer_digest, lambda payload: payload[:-1])
        self.assert_refused(f"layer {layer_digest}")

    def test_refuses_nonregular_child_layer_blob(self):
        layer_digest = self.child_manifest(self.first, "linux/arm64")["layers"][0]["digest"]
        member = "blobs/sha256/" + layer_digest.removeprefix("sha256:")
        self.replace_tar_member(self.first, member, lambda payload: ((member, b"Z", payload),))
        self.assert_refused("static.oci.tar linux/arm64 layer")

    def test_refuses_missing_oci_layout(self):
        files = self.archive_members(self.first)
        files.pop("oci-layout")
        self.first.write_bytes(tar_bytes(files))
        self.assert_refused("static.oci.tar must hold one regular oci-layout")

    def test_refuses_stale_size_for_an_otherwise_exact_manifest(self):
        def stale_size(payload):
            index = json.loads(payload)
            child = next(member for member in index["manifests"] if member["platform"]["architecture"] == "arm64")
            child["size"] += 1
            return json.dumps(index).encode()

        self.change_parent(stale_size)
        self.assert_refused("static.oci.tar linux/arm64 manifest")

    def test_refuses_an_object_instead_of_a_parent_manifest_array(self):
        def object_manifests(payload):
            index = json.loads(payload)
            index["manifests"] = {member["platform"]["architecture"]: member for member in index["manifests"]}
            return json.dumps(index).encode()

        self.change_parent(object_manifests)
        self.assert_refused("static.oci.tar must hold one OCI image manifest per Bake platform")

    def test_refuses_two_matching_json_values_in_one_parent_index_member(self):
        self.change_parent(lambda payload: payload + b"\n" + payload)
        self.assert_refused("static.oci.tar must hold one OCI image manifest per Bake platform")

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
        self.assert_refused("again.oci.tar index.json must contain one JSON document", verify_reproducibility=True)

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
