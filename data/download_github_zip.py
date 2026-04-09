#!/usr/bin/env python3
"""Download one or more GitHub URLs, then extract zip files into the data directory."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
import zipfile


def normalize_github_url(url: str) -> str:
    """Convert GitHub blob URLs to raw URLs when possible."""
    parsed = urlparse(url)
    if parsed.netloc != "github.com":
        return url

    parts = [segment for segment in parsed.path.split("/") if segment]
    # Expected: /<owner>/<repo>/blob/<branch>/<path...>
    if len(parts) >= 5 and parts[2] == "blob":
        owner, repo, _, branch, *file_path = parts
        raw_path = "/".join(file_path)
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{raw_path}"

    return url


def safe_extract_zip(zip_path: Path, destination_dir: Path) -> None:
    """Extract zip entries while blocking path traversal."""
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            target_path = (destination_dir / member.filename).resolve()
            if not str(target_path).startswith(str(destination_dir.resolve())):
                raise ValueError(f"Blocked unsafe zip member path: {member.filename}")
        archive.extractall(destination_dir)


def choose_download_path(url: str, destination_dir: Path) -> Path:
    """Pick a non-conflicting output filename in destination_dir."""
    name = Path(urlparse(url).path).name or "downloaded_file"
    candidate = destination_dir / name
    if not candidate.exists():
        return candidate

    stem = candidate.stem
    suffix = candidate.suffix
    index = 1
    while True:
        deduped = destination_dir / f"{stem}_{index}{suffix}"
        if not deduped.exists():
            return deduped
        index += 1


def download_url(url: str, output_path: Path) -> None:
    with urlopen(url) as response, output_path.open("wb") as destination:
        shutil.copyfileobj(response, destination)


def process_url(url: str, destination_dir: Path, dry_run: bool = False) -> None:
    resolved_url = normalize_github_url(url)
    output_path = choose_download_path(resolved_url, destination_dir)

    print(f"URL: {url}")
    if resolved_url != url:
        print(f"Resolved to: {resolved_url}")
    print(f"Download target: {output_path}")

    if dry_run:
        print("Dry-run mode enabled; skipping download and extraction.")
        print()
        return

    download_url(resolved_url, output_path)

    if zipfile.is_zipfile(output_path):
        safe_extract_zip(output_path, destination_dir)
        print(f"Extracted zip contents into: {destination_dir}")
        output_path.unlink()
        print(f"Deleted archive: {output_path}")
    else:
        print("Downloaded file is not a zip archive; extraction skipped.")

    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download one or more GitHub links (including blob links) into the data "
            "directory and extract zip files."
        )
    )
    parser.add_argument(
        "urls",
        nargs="+",
        help="One or multiple URLs to download.",
    )
    parser.add_argument(
        "--output-dir",
        default=Path(__file__).resolve().parent,
        type=Path,
        help="Directory where files are saved and extracted (default: ./data).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned actions without downloading files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    destination_dir = args.output_dir.resolve()
    destination_dir.mkdir(parents=True, exist_ok=True)

    try:
        for url in args.urls:
            process_url(url, destination_dir, dry_run=args.dry_run)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

