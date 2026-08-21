#!/usr/bin/env python3
"""Build the compact server-only MCM grounding snapshot used by LIVE analysis.

The complete authored research stays under ``docs/knowledge-base``. Runtime
code receives only a manually reviewed claim allow-list and the provenance
needed to audit those claims. Product snapshots, image registries, and
context/history/legal/care/sourcing records are never copied into the runtime
artifact.
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

# Ordering is part of the runtime contract. Dynamic records are eligible for
# lexical top-k retrieval. Safety records are rendered into every final prompt
# and are deliberately never dependent on retrieval recall.
DYNAMIC_CLAIM_IDS = (
    "CLM-008",
    "CLM-009",
    "CLM-011",
    "CLM-012",
    "CLM-038",
    "CLM-039",
    "CLM-044",
    "CLM-059",
    "CLM-068",
    "CLM-069",
    "CLM-085",
)
ALWAYS_ON_SAFETY_CLAIM_IDS = (
    "CLM-029",
    "CLM-040",
    "CLM-061",
    "CLM-062",
    "CLM-084",
    "CLM-089",
    "CLM-090",
)
ORDERED_CLAIM_IDS = DYNAMIC_CLAIM_IDS + ALWAYS_ON_SAFETY_CLAIM_IDS

PROMPT_SAFE_TEXT_OVERRIDES = {
    "CLM-089": (
        "Resetos=regenerated leather 표기만으로 함량·결합재·동물종·무두질·"
        "코팅·비건 여부를 확정하지 않는다."
    ),
    "CLM-090": (
        "Vachetta 명칭만으로 동물종·grain·vegetable tannage를 확정하지 "
        "않는다."
    ),
}

ALLOWED_RUNTIME_TOPICS = frozenset(
    {"pattern", "design", "material", "leather_type", "construction", "process"}
)
SOURCE_FIELDS = (
    "source_id",
    "publisher",
    "title",
    "url",
    "source_class",
    "authority_grade",
    "published_at",
    "observed_at",
)


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


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def require_text(record: dict[str, Any], field: str, label: str) -> str:
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label}: {field} must be a non-empty string")
    return value.strip()


def validate_selected_claim(
    claim: dict[str, Any],
    runtime_role: str,
    source_by_id: dict[str, dict[str, Any]],
) -> None:
    claim_id = require_text(claim, "claim_id", "runtime claim")
    label = f"runtime claim {claim_id}"
    expected_ai_use = (
        "grounding" if runtime_role == "dynamic" else "negative_constraint"
    )
    if claim.get("ai_use") != expected_ai_use:
        raise ValueError(f"{label}: ai_use must be {expected_ai_use}")
    if claim.get("topic") not in ALLOWED_RUNTIME_TOPICS:
        raise ValueError(f"{label}: topic is not allowed in the runtime snapshot")
    if claim.get("confidence") not in {"high", "medium"}:
        raise ValueError(f"{label}: confidence must be high or medium")
    evidence_mode = claim.get("evidence_mode")
    if evidence_mode not in {"direct", "derived"} and not (
        runtime_role == "always_on_safety" and evidence_mode == "unknown"
    ):
        raise ValueError(
            f"{label}: evidence_mode must be direct/derived, or unknown for safety"
        )
    evidence = claim.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        raise ValueError(f"{label}: evidence must be a non-empty array")
    for item in evidence:
        if not isinstance(item, dict):
            raise ValueError(f"{label}: evidence entries must be objects")
        source_id = require_text(item, "source_id", label)
        if source_id not in source_by_id:
            raise ValueError(f"{label}: unknown source_id {source_id}")


def compact_claim(claim: dict[str, Any], runtime_role: str) -> dict[str, Any]:
    claim_id = claim["claim_id"]
    authored_text = require_text(claim, "claim_ko", f"runtime claim {claim_id}")
    prompt_safe_text = PROMPT_SAFE_TEXT_OVERRIDES.get(claim_id, authored_text)
    return {
        "claim_id": claim_id,
        "runtime_role": runtime_role,
        "topic": claim["topic"],
        "subject": claim["subject"],
        "prompt_safe_text": prompt_safe_text,
        "prompt_safe_override": claim_id in PROMPT_SAFE_TEXT_OVERRIDES,
        "authored_text_sha256": hashlib.sha256(
            authored_text.encode("utf-8")
        ).hexdigest(),
        "fact_scope": claim["fact_scope"],
        "claim_owner": claim["claim_owner"],
        "evidence_mode": claim["evidence_mode"],
        "ai_use": claim["ai_use"],
        "confidence": claim["confidence"],
        "valid_time": claim["valid_time"],
        "observed_at": claim["observed_at"],
        "evidence": claim["evidence"],
    }


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

    source_by_id = {
        require_text(source, "source_id", "source"): source
        for source in sources
        if isinstance(source, dict)
    }
    if len(source_by_id) != len(sources):
        raise ValueError(f"{SOURCE_PATH}: duplicate or invalid source_id")
    claim_by_id = {
        require_text(claim, "claim_id", "claim"): claim for claim in claims
    }
    if len(claim_by_id) != len(claims):
        raise ValueError(f"{CLAIM_PATH}: duplicate or invalid claim_id")

    missing_claim_ids = [
        claim_id for claim_id in ORDERED_CLAIM_IDS if claim_id not in claim_by_id
    ]
    if missing_claim_ids:
        raise ValueError(f"Missing runtime claims: {', '.join(missing_claim_ids)}")

    runtime_claims: list[dict[str, Any]] = []
    referenced_source_ids: set[str] = set()
    for claim_id in ORDERED_CLAIM_IDS:
        claim = claim_by_id[claim_id]
        runtime_role = (
            "dynamic" if claim_id in DYNAMIC_CLAIM_IDS else "always_on_safety"
        )
        validate_selected_claim(claim, runtime_role, source_by_id)
        runtime_claims.append(compact_claim(claim, runtime_role))
        referenced_source_ids.update(
            evidence["source_id"] for evidence in claim["evidence"]
        )

    runtime_sources = [
        {field: source_by_id[source_id].get(field) for field in SOURCE_FIELDS}
        for source_id in sorted(referenced_source_ids)
    ]
    source_files = {
        "sources.json": file_sha256(SOURCE_PATH),
        "claims.jsonl": file_sha256(CLAIM_PATH),
        "products.jsonl": file_sha256(PRODUCT_PATH),
    }
    full_corpus_sha256 = canonical_sha256(source_files)
    runtime_corpus = {
        "knowledge_base_version": version_match.group(1),
        "ordered_claim_ids": list(ORDERED_CLAIM_IDS),
        "dynamic_claim_ids": list(DYNAMIC_CLAIM_IDS),
        "always_on_safety_claim_ids": list(ALWAYS_ON_SAFETY_CLAIM_IDS),
        "sources": runtime_sources,
        "claims": runtime_claims,
    }

    return {
        "record_type": "mcm_leather_wiki_runtime_snapshot",
        "knowledge_base_version": version_match.group(1),
        "full_corpus_sha256": full_corpus_sha256,
        "retrieval_corpus_sha256": canonical_sha256(runtime_corpus),
        "source_files": source_files,
        "ordered_claim_ids": list(ORDERED_CLAIM_IDS),
        "dynamic_claim_ids": list(DYNAMIC_CLAIM_IDS),
        "always_on_safety_claim_ids": list(ALWAYS_ON_SAFETY_CLAIM_IDS),
        "counts": {
            "authored_sources": len(sources),
            "authored_claims": len(claims),
            "authored_products": len(products),
            "runtime_sources": len(runtime_sources),
            "runtime_claims": len(runtime_claims),
        },
        "sources": runtime_sources,
        "claims": runtime_claims,
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
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
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
