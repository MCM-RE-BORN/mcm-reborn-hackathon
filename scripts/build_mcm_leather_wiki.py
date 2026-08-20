#!/usr/bin/env python3
"""Build the server-only MCM leather wiki snapshot used by LIVE analysis.

The authored knowledge base remains under docs/knowledge-base. This script
creates one deterministic JSON artifact that Next.js can statically bundle,
without relying on runtime filesystem access to JSONL files outside the app.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
KB_ROOT = REPO_ROOT / "docs" / "knowledge-base" / "mcm-leather-bags"
README_PATH = KB_ROOT / "README.md"
SOURCE_PATH = KB_ROOT / "data" / "sources.json"
CLAIM_PATH = KB_ROOT / "data" / "claims.jsonl"
PRODUCT_PATH = KB_ROOT / "data" / "products.jsonl"
OUTPUT_PATH = (
    REPO_ROOT
    / "mcm-reborn"
    / "server"
    / "knowledge"
    / "mcmLeatherWiki.generated.json"
)
VERSION_RE = re.compile(r"^버전:\s*`([^`]+)`\s*$", re.MULTILINE)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line:
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"{path}:{line_number}: expected an object")
        records.append(value)
    return records


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_snapshot() -> dict[str, Any]:
    readme = README_PATH.read_text(encoding="utf-8")
    version_match = VERSION_RE.search(readme)
    if not version_match:
        raise ValueError(f"Knowledge version is missing from {README_PATH}")

    sources = load_json(SOURCE_PATH)
    claims = load_jsonl(CLAIM_PATH)
    products = load_jsonl(PRODUCT_PATH)
    if not isinstance(sources, list):
        raise ValueError(f"{SOURCE_PATH}: expected an array")

    source_files = {
        "sources.json": sha256(SOURCE_PATH),
        "claims.jsonl": sha256(CLAIM_PATH),
        "products.jsonl": sha256(PRODUCT_PATH),
    }
    digest_input = "\n".join(
        f"{name}:{digest}" for name, digest in source_files.items()
    ).encode("utf-8")

    return {
        "record_type": "mcm_leather_wiki_snapshot",
        "knowledge_base_version": version_match.group(1),
        "retrieval_corpus_sha256": hashlib.sha256(digest_input).hexdigest(),
        "source_files": source_files,
        "counts": {
            "sources": len(sources),
            "claims": len(claims),
            "products": len(products),
        },
        "sources": sources,
        "claims": claims,
        "products": products,
    }


def serialize(snapshot: dict[str, Any]) -> str:
    return json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the committed runtime snapshot is missing or stale.",
    )
    args = parser.parse_args()

    try:
        expected = serialize(build_snapshot())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"MCM leather wiki build failed: {error}", file=sys.stderr)
        return 1

    if args.check:
        if not OUTPUT_PATH.exists():
            print(f"MCM leather wiki snapshot is missing: {OUTPUT_PATH}", file=sys.stderr)
            return 1
        if OUTPUT_PATH.read_text(encoding="utf-8") != expected:
            print(
                "MCM leather wiki snapshot is stale; run "
                "python -X utf8 scripts/build_mcm_leather_wiki.py",
                file=sys.stderr,
            )
            return 1
        print("MCM leather wiki snapshot is current.")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(expected, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
