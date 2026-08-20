from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_ROOT = ROOT / "docs" / "knowledge-base" / "mcm-leather-bags"
README_PATH = KNOWLEDGE_ROOT / "README.md"
CLAIMS_PATH = KNOWLEDGE_ROOT / "data" / "claims.jsonl"
OUTPUT_PATH = (
    ROOT
    / "mcm-reborn"
    / "server"
    / "openai"
    / "generated"
    / "mcmPublicGrounding.ts"
)

CURATED_CLAIM_IDS = (
    "CLM-003",
    "CLM-009",
    "CLM-011",
    "CLM-012",
    "CLM-029",
    "CLM-035",
    "CLM-040",
    "CLM-046",
    "CLM-059",
    "CLM-061",
    "CLM-068",
    "CLM-069",
    "CLM-084",
    "CLM-085",
    "CLM-089",
    "CLM-090",
)
CURATED_CLAIM_ID_SET = frozenset(CURATED_CLAIM_IDS)
ALLOWED_AI_USE = frozenset({"grounding", "negative_constraint"})
ALLOWED_CONFIDENCE = frozenset({"high", "medium"})
DIRECT_EVIDENCE_MODES = frozenset({"direct", "derived"})
VERSION_PATTERN = re.compile(r"^버전:\s*`([^`\r\n]+)`\s*$", re.MULTILINE)


class GroundingBuildError(Exception):
    pass


def normalize_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFC", value).split())


def read_utf8(path: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8")
    except FileNotFoundError as error:
        raise GroundingBuildError(f"missing input: {path.relative_to(ROOT)}") from error
    except UnicodeDecodeError as error:
        raise GroundingBuildError(
            f"input is not valid UTF-8: {path.relative_to(ROOT)}"
        ) from error


def read_knowledge_version() -> str:
    matches = VERSION_PATTERN.findall(read_utf8(README_PATH))
    if len(matches) != 1:
        raise GroundingBuildError(
            "README must contain exactly one `버전: `...`` declaration"
        )
    version = normalize_text(matches[0])
    if not version:
        raise GroundingBuildError("README knowledge version must not be empty")
    return version


def parse_claim(raw_line: str, line_number: int) -> dict[str, Any]:
    try:
        value = json.loads(raw_line)
    except json.JSONDecodeError as error:
        raise GroundingBuildError(
            f"claims.jsonl line {line_number}: invalid JSON: {error.msg}"
        ) from error
    if not isinstance(value, dict):
        raise GroundingBuildError(
            f"claims.jsonl line {line_number}: expected a JSON object"
        )
    return value


def validate_selected_claim(
    record: dict[str, Any], line_number: int
) -> dict[str, str]:
    claim_id = record.get("claim_id")
    label = f"claims.jsonl line {line_number} ({claim_id})"
    if record.get("record_type") != "claim":
        raise GroundingBuildError(f"{label}: record_type must be `claim`")

    claim_text = record.get("claim_ko")
    if not isinstance(claim_text, str) or not normalize_text(claim_text):
        raise GroundingBuildError(f"{label}: claim_ko must be non-empty text")

    ai_use = record.get("ai_use")
    if ai_use not in ALLOWED_AI_USE:
        raise GroundingBuildError(
            f"{label}: ai_use must be grounding or negative_constraint"
        )

    evidence_mode = record.get("evidence_mode")
    evidence_mode_allowed = evidence_mode in DIRECT_EVIDENCE_MODES or (
        evidence_mode == "unknown" and ai_use == "negative_constraint"
    )
    if not evidence_mode_allowed:
        raise GroundingBuildError(
            f"{label}: evidence_mode must be direct/derived; unknown is allowed "
            "only for negative_constraint"
        )

    confidence = record.get("confidence")
    if confidence not in ALLOWED_CONFIDENCE:
        raise GroundingBuildError(
            f"{label}: confidence must be high or medium"
        )

    return {
        "aiUse": ai_use,
        "claimId": claim_id,
        "confidence": confidence,
        "evidenceMode": evidence_mode,
        "text": normalize_text(claim_text),
    }


def load_selected_claims() -> list[dict[str, str]]:
    selected: dict[str, dict[str, str]] = {}
    claims_text = read_utf8(CLAIMS_PATH)
    for line_number, raw_line in enumerate(claims_text.splitlines(), start=1):
        if not raw_line.strip():
            continue
        record = parse_claim(raw_line, line_number)
        claim_id = record.get("claim_id")
        if claim_id not in CURATED_CLAIM_ID_SET:
            continue
        if claim_id in selected:
            raise GroundingBuildError(f"duplicate curated claim_id: {claim_id}")
        selected[claim_id] = validate_selected_claim(record, line_number)

    missing = [claim_id for claim_id in CURATED_CLAIM_IDS if claim_id not in selected]
    if missing:
        raise GroundingBuildError(
            "missing curated claim IDs: " + ", ".join(missing)
        )
    return [selected[claim_id] for claim_id in CURATED_CLAIM_IDS]


def canonical_sha256(
    knowledge_version: str, claims: list[dict[str, str]]
) -> str:
    canonical_payload = {
        "claims": claims,
        "knowledgeBaseVersion": knowledge_version,
    }
    canonical_json = json.dumps(
        canonical_payload,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def typescript_string(value: str) -> str:
    return (
        json.dumps(value, ensure_ascii=False)
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def render_typescript(
    knowledge_version: str,
    claims: list[dict[str, str]],
    content_sha256: str,
) -> str:
    lines = [
        "// Generated by scripts/build_mcm_runtime_grounding.py. DO NOT EDIT.",
        "// The SHA-256 covers canonical UTF-8 JSON of the version, normalized",
        "// claim ID/text, ai_use, evidence_mode, and confidence values.",
        "",
        "export const MCM_PUBLIC_GROUNDING_VERSION =",
        f"  {typescript_string(knowledge_version)} as const;",
        "",
        "export const MCM_PUBLIC_GROUNDING_CLAIMS = [",
    ]
    for claim in claims:
        lines.extend(
            [
                "  {",
                f"    id: {typescript_string(claim['claimId'])},",
                f"    text: {typescript_string(claim['text'])},",
                "  },",
            ]
        )
    lines.extend(
        [
            "] as const;",
            "",
            "export const MCM_PUBLIC_GROUNDING_CANONICAL_SHA256 =",
            f"  {typescript_string(content_sha256)} as const;",
            "",
        ]
    )
    return "\n".join(lines)


def build_expected_output() -> tuple[str, str]:
    knowledge_version = read_knowledge_version()
    claims = load_selected_claims()
    content_sha256 = canonical_sha256(knowledge_version, claims)
    return render_typescript(knowledge_version, claims, content_sha256), content_sha256


def check_output(expected: str, content_sha256: str) -> int:
    try:
        actual = OUTPUT_PATH.read_bytes()
    except FileNotFoundError:
        print(
            f"Stale MCM runtime grounding: missing {OUTPUT_PATH.relative_to(ROOT)}",
            file=sys.stderr,
        )
        return 1
    if actual != expected.encode("utf-8"):
        print(
            "Stale MCM runtime grounding: run "
            "`python -X utf8 scripts/build_mcm_runtime_grounding.py`",
            file=sys.stderr,
        )
        return 1
    print(
        "MCM runtime grounding is current: "
        f"{len(CURATED_CLAIM_IDS)} claims, sha256 {content_sha256}"
    )
    return 0


def write_output(expected: str, content_sha256: str) -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(expected.encode("utf-8"))
    print(
        f"Generated {OUTPUT_PATH.relative_to(ROOT)}: "
        f"{len(CURATED_CLAIM_IDS)} claims, sha256 {content_sha256}"
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compile curated MCM public claims into runtime TypeScript."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when the generated TypeScript is missing or stale",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        expected, content_sha256 = build_expected_output()
    except GroundingBuildError as error:
        print(f"MCM runtime grounding build failed: {error}", file=sys.stderr)
        return 1
    if args.check:
        return check_output(expected, content_sha256)
    return write_output(expected, content_sha256)


if __name__ == "__main__":
    sys.exit(main())
