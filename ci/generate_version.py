#                                  MIT License
#                       Copyright 2026, Sébastien Kéroack
# ==============================================================================
# --- References:
# see: https://semver.org/
# ==============================================================================

import subprocess
from pathlib import Path

UNKNOWN = "Unknown"


def get_sha(project_root: str | Path) -> str:
    project_root = Path(project_root)

    # If not a git working tree.
    if not (project_root / ".git").exists():
        return UNKNOWN

    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=project_root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        sha = result.stdout.strip()
        return sha if sha and sha != "HEAD" else UNKNOWN
    except Exception:
        return UNKNOWN


def get_tag(project_root: str | Path) -> str:
    try:
        tag = subprocess.run(
            ["git", "describe", "--tags", "--exact-match"],
            cwd=project_root,
            encoding="ascii",
            capture_output=True,
        ).stdout.strip()
        return tag or UNKNOWN
    except Exception:
        return UNKNOWN


def get_project_version(sha: str | None = None) -> str:
    """Determine the project version string.
    Uses version.txt and appends git SHA if available."""
    project_root = Path(__file__).absolute().parent.parent
    version_file = project_root / "version.txt"
    if version_file.exists():
        with version_file.open() as f:
            version = next(f, UNKNOWN).strip().split("+")[0]
    else:
        version = UNKNOWN
    if sha and sha != UNKNOWN:
        version += f"+git{sha[:7]}"
    return version


def replace_line(file_path: Path, new_line: str, *, at: int) -> None:
    # Read all lines from the file
    lines = []
    with file_path.open("r") as f:
        lines = f.readlines()
    # Replace the desired line
    lines[at] = new_line + "\n"
    # Write the modified line back to the file
    with file_path.open("w") as f:
        f.writelines(lines)


if __name__ == "__main__":
    project_root = Path(__file__).parent.parent
    tagged_version = get_tag(project_root)
    sha = get_sha(project_root)
    if tagged_version == UNKNOWN:
        version = get_project_version(sha)
    else:
        version = tagged_version

    # Write version.py
    with open(project_root / "job_search_pipeline" / "version.py", "w") as f:
        f.write('__all__ = ["__version__", "git_version"]\n')
        f.write(f'__version__ = "{version}"\n')
        f.write(f'git_version = "{sha}"\n')

    # Untag versions
    untagged_version = version.split("+")[0]

    # Update version.txt
    replace_line(project_root / "version.txt", untagged_version, at=0)

    # Update pyproject.toml
    replace_line(
        project_root / "pyproject.toml", f'version = "{untagged_version}"', at=2
    )

    # Update package.json
    replace_line(
        project_root / "package.json", f'  "version": "{untagged_version}",', at=2
    )
