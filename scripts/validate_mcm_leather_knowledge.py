#!/usr/bin/env python3
"""Validate the provenance-aware MCM leather-bag research dataset.

The validator deliberately uses only the Python standard library so the
research snapshot can be checked without installing a JSON Schema package.
It covers the invariants that matter most for retrieval: parseability,
identity, dates, source links, conflict groups, product component shape,
and official-channel image-reference provenance. Every record is also checked
against the repository's JSON Schema with a small standard-library validator
for the schema keywords used by this knowledge base.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[1]
KB_ROOT = REPO_ROOT / "docs" / "knowledge-base" / "mcm-leather-bags"
SOURCE_PATH = KB_ROOT / "data" / "sources.json"
CLAIM_PATH = KB_ROOT / "data" / "claims.jsonl"
PRODUCT_PATH = KB_ROOT / "data" / "products.jsonl"
PATTERN_IMAGE_PATH = KB_ROOT / "data" / "pattern_image_references.jsonl"
MATERIAL_IMAGE_PATH = KB_ROOT / "data" / "material_image_references.jsonl"
SCHEMA_PATH = KB_ROOT / "schema" / "knowledge-record.schema.json"

SOURCE_ID_RE = re.compile(r"^SRC-[0-9]{3}$")
CLAIM_ID_RE = re.compile(r"^CLM-[0-9]{3}$")
PRODUCT_ID_RE = re.compile(r"^PRD-[0-9]{3}$")
CONFLICT_ID_RE = re.compile(r"^CONFLICT-[0-9]{3}$")
IMAGE_ID_RE = re.compile(r"^(PIMG|MIMG|CIMG)-[0-9]{3}$")
ISO_DATE_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
LANGUAGE_RE = re.compile(r"^[a-z]{2}(-[A-Z]{2})?$")
MARKET_RE = re.compile(r"^[A-Z]{2}$")

SOURCE_REQUIRED = {
    "record_type",
    "source_id",
    "publisher",
    "title",
    "url",
    "source_class",
    "authority_grade",
    "published_at",
    "date_precision",
    "observed_at",
    "language",
    "access_status",
    "notes",
}
CLAIM_REQUIRED = {
    "record_type",
    "claim_id",
    "topic",
    "subject",
    "claim_ko",
    "fact_scope",
    "claim_owner",
    "evidence_mode",
    "confidence",
    "valid_time",
    "observed_at",
    "evidence",
    "conflict_group_id",
    "ai_use",
    "notes",
}
PRODUCT_REQUIRED = {
    "record_type",
    "product_id",
    "style_number",
    "name",
    "family",
    "collection_or_season",
    "market",
    "pattern_family",
    "silhouette",
    "components",
    "product_made_in",
    "observed_at",
    "source_ids",
    "evidence",
    "confidence",
    "notes",
}
PRODUCT_OPTIONAL = {
    "construction_features",
    "composition_claims",
    "measurements",
}
COMPONENT_REQUIRED = {
    "role",
    "material_class",
    "material_label",
    "animal_species",
    "leather_type",
    "grain_structure",
    "surface_finish",
    "tannage",
    "substrate_fiber",
    "coating_polymer",
    "material_origin_country",
    "attribute_state",
}
ATTRIBUTE_FIELDS = {
    "animal_species",
    "leather_type",
    "grain_structure",
    "surface_finish",
    "tannage",
    "substrate_fiber",
    "coating_polymer",
    "material_origin_country",
}
TIME_REQUIRED = {"label", "start", "end", "precision", "status"}
EVIDENCE_REQUIRED = {"source_id", "locator", "support"}
MEASUREMENT_REQUIRED = {
    "kind",
    "raw_value",
    "unit",
    "values",
    "value_order",
    "notes",
}
IMAGE_REQUIRED = {
    "record_type",
    "image_id",
    "subject_type",
    "subject",
    "style_number",
    "market",
    "tags",
    "asset_id",
    "image_url",
    "source_id",
    "source_page_url",
    "source_page_redirected_from",
    "caption",
    "raw_alt_text",
    "published_at",
    "date_precision",
    "date_basis",
    "observed_at",
    "checked_at",
    "http_status",
    "content_type",
    "verification_method",
    "channel_status",
    "rights_status",
    "association_confidence",
    "tag_evidence_mode",
    "notes",
}
IMAGE_OPTIONAL = {"content_sha256", "response_bytes"}

FACT_SCOPES = {
    "mcm_brand",
    "mcm_product",
    "supplier_historical",
    "industry_general",
    "legal_record",
}
TOPICS = {
    "history",
    "pattern",
    "design",
    "material",
    "leather_type",
    "construction",
    "process",
    "sourcing",
    "sustainability",
    "care",
    "legal",
    "unknown",
}
EVIDENCE_MODES = {"direct", "derived", "inferred", "unknown"}
CONFIDENCE_LEVELS = {"high", "medium", "low", "unknown"}
AI_USES = {"grounding", "context_only", "negative_constraint", "exclude"}
SUPPORT_TYPES = {"supports", "contradicts", "context_only"}
TIME_PRECISIONS = {"day", "month", "year", "season", "range", "unknown"}
TIME_STATUSES = {
    "current_snapshot",
    "historical_snapshot",
    "launch_or_release",
    "first_verified_presence",
    "reporting_period",
    "target",
    "legal_event",
    "standard_version",
    "reference_snapshot",
    "unknown",
}
SOURCE_CLASSES = {
    "mcm_official",
    "mcm_report",
    "group_official",
    "public_registry",
    "standards_body",
    "intergovernmental",
    "industry_press",
    "major_press",
    "retailer_or_catalog",
    "legal_filing",
    "legal_aggregator",
}
AUTHORITY_GRADES = {"A", "S", "B", "C", "D"}
SOURCE_DATE_PRECISIONS = {"day", "month", "year", "unknown"}
ACCESS_STATUSES = {
    "open",
    "indexed_only",
    "pdf_indexed",
    "blocked_direct_fetch",
    "indexed_and_direct_fetch_blocked",
}
COMPONENT_ROLES = {
    "body",
    "flap",
    "side_panel",
    "trim",
    "lining",
    "handle",
    "strap",
    "reinforcement",
    "hardware",
    "decoration",
    "pouch",
}
MATERIAL_CLASSES = {
    "leather",
    "coated_canvas",
    "textile",
    "metal",
    "mixed",
    "regenerated_leather",
    "alternative_material",
    "decoration",
    "unknown",
}
ATTRIBUTE_STATES = {"reported", "unknown", "not_applicable"}
IMAGE_DATE_PRECISIONS = {"day", "month", "year", "unknown"}
IMAGE_DATE_BASES = {"source_page_publication", "cdn_asset_header", "unknown"}
IMAGE_CONTENT_TYPES = {"image/jpeg", "image/webp"}
IMAGE_ASSOCIATION_CONFIDENCE = {"high", "medium", "low"}
IMAGE_TAG_EVIDENCE_MODES = {
    "source_metadata",
    "dom_context",
    "mixed",
    "context_only",
}
MEASUREMENT_KINDS = {"overall_dimensions", "strap_length", "handle_drop"}
MEASUREMENT_VALUE_ORDERS = {"source_order_unlabeled", "min_max", "single"}
OFFICIAL_PAGE_IMAGE_HOSTS = {
    "images.mcmworldwide.com",
    "cdn.media.amplience.net",
    "i1.adis.ws",
}


def load_json(path: Path, errors: list[str]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{path}: cannot parse JSON: {exc}")
        return None


def load_jsonl(path: Path, errors: list[str]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        errors.append(f"{path}: cannot read JSONL: {exc}")
        return records

    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            errors.append(f"{path}:{line_number}: blank JSONL line")
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"{path}:{line_number}: invalid JSON: {exc}")
            continue
        if not isinstance(value, dict):
            errors.append(f"{path}:{line_number}: record must be an object")
            continue
        records.append(value)
    return records


def check_date(value: Any, label: str, errors: list[str], allow_null: bool = False) -> None:
    if value is None and allow_null:
        return
    if not isinstance(value, str):
        errors.append(f"{label}: expected ISO date string")
        return
    if not ISO_DATE_RE.fullmatch(value):
        errors.append(f"{label}: expected strict YYYY-MM-DD date, got {value!r}")
        return
    try:
        date.fromisoformat(value)
    except ValueError:
        errors.append(f"{label}: invalid ISO date {value!r}")


def check_required(
    record: dict[str, Any], required: set[str], label: str, errors: list[str]
) -> None:
    missing = sorted(required - record.keys())
    if missing:
        errors.append(f"{label}: missing fields: {', '.join(missing)}")


def check_allowed(
    record: dict[str, Any], allowed: set[str], label: str, errors: list[str]
) -> None:
    unexpected = sorted(record.keys() - allowed)
    if unexpected:
        errors.append(f"{label}: unexpected fields: {', '.join(unexpected)}")


def check_non_empty_string(value: Any, label: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label}: expected non-empty string")


def check_unique(values: list[Any], label: str, errors: list[str]) -> None:
    duplicates = sorted(
        (value for value, count in Counter(values).items() if count > 1), key=str
    )
    if duplicates:
        errors.append(f"{label}: duplicate values: {', '.join(map(str, duplicates))}")


def check_contiguous_ids(
    values: list[str], prefix: str, label: str, errors: list[str]
) -> None:
    expected = [f"{prefix}{index:03d}" for index in range(1, len(values) + 1)]
    if values != expected:
        errors.append(f"{label}: IDs must be ordered and contiguous from {prefix}001")


def json_values_equal(left: Any, right: Any) -> bool:
    """Compare values using JSON Schema equality rather than Python coercion."""

    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool) and left == right
    if (
        isinstance(left, (int, float))
        and not isinstance(left, bool)
        and isinstance(right, (int, float))
        and not isinstance(right, bool)
    ):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, list):
        return len(left) == len(right) and all(
            json_values_equal(a, b) for a, b in zip(left, right)
        )
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(
            json_values_equal(left[key], right[key]) for key in left
        )
    return left == right


def json_type_matches(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return False


def resolve_local_ref(ref: Any, root_schema: dict[str, Any]) -> Any:
    if not isinstance(ref, str) or not ref.startswith("#/"):
        raise ValueError(f"unsupported reference {ref!r}")
    value: Any = root_schema
    for raw_part in ref[2:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or part not in value:
            raise ValueError(f"unresolved reference {ref!r}")
        value = value[part]
    return value


def schema_instance_errors(
    value: Any,
    schema: Any,
    root_schema: dict[str, Any],
    label: str,
) -> list[str]:
    """Validate the JSON Schema keyword subset used by this repository."""

    if not isinstance(schema, dict):
        return [f"{label}: schema node must be an object"]

    errors: list[str] = []

    if "$ref" in schema:
        try:
            referenced = resolve_local_ref(schema["$ref"], root_schema)
        except ValueError as exc:
            return [f"{label}: {exc}"]
        errors.extend(schema_instance_errors(value, referenced, root_schema, label))
        sibling_schema = {key: item for key, item in schema.items() if key != "$ref"}
        if sibling_schema:
            errors.extend(
                schema_instance_errors(value, sibling_schema, root_schema, label)
            )
        return errors

    one_of = schema.get("oneOf")
    if one_of is not None:
        if not isinstance(one_of, list) or not one_of:
            errors.append(f"{label}: schema oneOf must be a non-empty array")
        else:
            branch_errors = [
                schema_instance_errors(value, branch, root_schema, label)
                for branch in one_of
            ]
            matches = [index for index, branch in enumerate(branch_errors) if not branch]
            if len(matches) != 1:
                errors.append(
                    f"{label}: expected exactly one oneOf match, got {len(matches)}"
                )
                if not matches:
                    for index, branch in enumerate(branch_errors, start=1):
                        detail = branch[0] if branch else "matched"
                        errors.append(f"{label}: oneOf branch {index}: {detail}")

    expected_types = schema.get("type")
    if expected_types is not None:
        type_names = (
            expected_types if isinstance(expected_types, list) else [expected_types]
        )
        if not type_names or not all(isinstance(item, str) for item in type_names):
            errors.append(f"{label}: schema type must be a string or string array")
            return errors
        if not any(json_type_matches(value, item) for item in type_names):
            errors.append(
                f"{label}: expected JSON type {' or '.join(type_names)}, "
                f"got {type(value).__name__}"
            )
            return errors

    if "const" in schema and not json_values_equal(value, schema["const"]):
        errors.append(f"{label}: expected constant {schema['const']!r}")

    enum_values = schema.get("enum")
    if enum_values is not None:
        if not isinstance(enum_values, list):
            errors.append(f"{label}: schema enum must be an array")
        elif not any(json_values_equal(value, item) for item in enum_values):
            errors.append(f"{label}: value {value!r} is not in enum")

    if isinstance(value, dict):
        required = schema.get("required", [])
        if not isinstance(required, list):
            errors.append(f"{label}: schema required must be an array")
        else:
            missing = [key for key in required if key not in value]
            if missing:
                errors.append(f"{label}: missing required fields: {', '.join(missing)}")

        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            errors.append(f"{label}: schema properties must be an object")
            properties = {}
        for key, item in value.items():
            child_label = f"{label}.{key}"
            if key in properties:
                errors.extend(
                    schema_instance_errors(item, properties[key], root_schema, child_label)
                )
            elif schema.get("additionalProperties") is False:
                errors.append(f"{child_label}: additional property is not allowed")
            elif isinstance(schema.get("additionalProperties"), dict):
                errors.extend(
                    schema_instance_errors(
                        item, schema["additionalProperties"], root_schema, child_label
                    )
                )

    if isinstance(value, list):
        min_items = schema.get("minItems")
        if isinstance(min_items, int) and len(value) < min_items:
            errors.append(f"{label}: expected at least {min_items} items")
        items_schema = schema.get("items")
        if items_schema is not None:
            for index, item in enumerate(value):
                errors.extend(
                    schema_instance_errors(
                        item, items_schema, root_schema, f"{label}[{index + 1}]"
                    )
                )
        if schema.get("uniqueItems") is True:
            for left_index, left in enumerate(value):
                for right_index in range(left_index + 1, len(value)):
                    if json_values_equal(left, value[right_index]):
                        errors.append(
                            f"{label}: items {left_index + 1} and "
                            f"{right_index + 1} are not unique"
                        )

    if isinstance(value, str):
        min_length = schema.get("minLength")
        if isinstance(min_length, int) and len(value) < min_length:
            errors.append(f"{label}: expected minimum length {min_length}")

        pattern = schema.get("pattern")
        if pattern is not None:
            try:
                matched = isinstance(pattern, str) and re.search(pattern, value) is not None
            except re.error as exc:
                errors.append(f"{label}: invalid schema pattern {pattern!r}: {exc}")
            else:
                if not matched:
                    errors.append(f"{label}: value does not match pattern {pattern!r}")

        value_format = schema.get("format")
        if value_format == "date":
            if not ISO_DATE_RE.fullmatch(value):
                errors.append(f"{label}: expected strict YYYY-MM-DD date")
            else:
                try:
                    date.fromisoformat(value)
                except ValueError:
                    errors.append(f"{label}: invalid ISO date {value!r}")
        elif value_format == "uri":
            parsed = urlparse(value)
            if not parsed.scheme or (
                parsed.scheme in {"http", "https"} and not parsed.netloc
            ):
                errors.append(f"{label}: expected an absolute URI")
        elif value_format is not None:
            errors.append(f"{label}: unsupported schema format {value_format!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        if isinstance(minimum, (int, float)) and value < minimum:
            errors.append(f"{label}: value must be at least {minimum}")
        maximum = schema.get("maximum")
        if isinstance(maximum, (int, float)) and value > maximum:
            errors.append(f"{label}: value must be at most {maximum}")

    return errors


def validate_records_against_schema(
    records: Any,
    schema: Any,
    record_label: str,
    errors: list[str],
) -> None:
    if not isinstance(schema, dict):
        return
    if not isinstance(records, list):
        return
    for index, record in enumerate(records, start=1):
        errors.extend(
            schema_instance_errors(record, schema, schema, f"{record_label}[{index}]")
        )


def validate_sources(sources: Any, errors: list[str]) -> dict[str, str]:
    if not isinstance(sources, list):
        errors.append(f"{SOURCE_PATH}: root must be an array")
        return {}

    source_ids: list[str] = []
    source_urls: list[str] = []
    for index, source in enumerate(sources, start=1):
        label = f"source[{index}]"
        if not isinstance(source, dict):
            errors.append(f"{label}: expected object")
            continue
        check_required(source, SOURCE_REQUIRED, label, errors)
        check_allowed(source, SOURCE_REQUIRED, label, errors)
        source_id = source.get("source_id")
        if not isinstance(source_id, str) or not SOURCE_ID_RE.fullmatch(source_id):
            errors.append(f"{label}: invalid source_id {source_id!r}")
        else:
            source_ids.append(source_id)
        if source.get("record_type") != "source":
            errors.append(f"{label}: record_type must be 'source'")
        check_non_empty_string(source.get("publisher"), f"{label}.publisher", errors)
        check_non_empty_string(source.get("title"), f"{label}.title", errors)
        url = source.get("url")
        if not isinstance(url, str):
            errors.append(f"{label}: url must be a string")
        else:
            parsed = urlparse(url)
            if parsed.scheme != "https" or not parsed.netloc:
                errors.append(f"{label}: url must be an absolute HTTPS URL")
            else:
                source_urls.append(url)
        check_date(source.get("published_at"), f"{label}.published_at", errors, True)
        check_date(source.get("observed_at"), f"{label}.observed_at", errors)
        if source.get("source_class") not in SOURCE_CLASSES:
            errors.append(f"{label}: invalid source_class {source.get('source_class')!r}")
        if source.get("authority_grade") not in AUTHORITY_GRADES:
            errors.append(
                f"{label}: invalid authority_grade {source.get('authority_grade')!r}"
            )
        if source.get("date_precision") not in SOURCE_DATE_PRECISIONS:
            errors.append(
                f"{label}: invalid date_precision {source.get('date_precision')!r}"
            )
        elif source.get("published_at") is None and source.get("date_precision") != "unknown":
            errors.append(f"{label}: null published_at requires unknown date_precision")
        elif source.get("published_at") is not None and source.get("date_precision") == "unknown":
            errors.append(f"{label}: dated source requires known date_precision")
        if source.get("access_status") not in ACCESS_STATUSES:
            errors.append(
                f"{label}: invalid access_status {source.get('access_status')!r}"
            )
        language = source.get("language")
        if not isinstance(language, str) or not LANGUAGE_RE.fullmatch(language):
            errors.append(f"{label}: invalid language tag {language!r}")
        if not isinstance(source.get("notes"), str):
            errors.append(f"{label}: notes must be a string")

    check_unique(source_ids, "source_id", errors)
    check_contiguous_ids(source_ids, "SRC-", "source_id", errors)
    check_unique(source_urls, "source URL", errors)
    return {
        source["source_id"]: source["url"]
        for source in sources
        if isinstance(source, dict)
        and isinstance(source.get("source_id"), str)
        and isinstance(source.get("url"), str)
        and SOURCE_ID_RE.fullmatch(source["source_id"])
    }


def validate_time(value: Any, label: str, errors: list[str]) -> None:
    if not isinstance(value, dict):
        errors.append(f"{label}: expected object")
        return
    check_required(value, TIME_REQUIRED, label, errors)
    check_allowed(value, TIME_REQUIRED, label, errors)
    check_non_empty_string(value.get("label"), f"{label}.label", errors)
    check_date(value.get("start"), f"{label}.start", errors, True)
    check_date(value.get("end"), f"{label}.end", errors, True)
    start = value.get("start")
    end = value.get("end")
    if isinstance(start, str) and isinstance(end, str) and start > end:
        errors.append(f"{label}: start must not be after end")
    if value.get("precision") not in TIME_PRECISIONS:
        errors.append(f"{label}: invalid precision {value.get('precision')!r}")
    elif start is None and end is None and value.get("precision") != "unknown":
        errors.append(f"{label}: undated time context requires unknown precision")
    elif (start is not None or end is not None) and value.get("precision") == "unknown":
        errors.append(f"{label}: dated time context requires known precision")
    if value.get("status") not in TIME_STATUSES:
        errors.append(f"{label}: invalid status {value.get('status')!r}")


def validate_claims(
    claims: list[dict[str, Any]], source_ids: set[str], errors: list[str]
) -> None:
    claim_ids: list[str] = []
    conflict_ids: list[str] = []

    for index, claim in enumerate(claims, start=1):
        label = f"claim[{index}]"
        check_required(claim, CLAIM_REQUIRED, label, errors)
        check_allowed(claim, CLAIM_REQUIRED, label, errors)
        claim_id = claim.get("claim_id")
        if not isinstance(claim_id, str) or not CLAIM_ID_RE.fullmatch(claim_id):
            errors.append(f"{label}: invalid claim_id {claim_id!r}")
        else:
            claim_ids.append(claim_id)
        if claim.get("record_type") != "claim":
            errors.append(f"{label}: record_type must be 'claim'")
        if claim.get("topic") not in TOPICS:
            errors.append(f"{label}: invalid topic {claim.get('topic')!r}")
        check_non_empty_string(claim.get("subject"), f"{label}.subject", errors)
        check_non_empty_string(claim.get("claim_ko"), f"{label}.claim_ko", errors)
        check_non_empty_string(
            claim.get("claim_owner"), f"{label}.claim_owner", errors
        )
        if claim.get("fact_scope") not in FACT_SCOPES:
            errors.append(f"{label}: invalid fact_scope {claim.get('fact_scope')!r}")
        if claim.get("evidence_mode") not in EVIDENCE_MODES:
            errors.append(f"{label}: invalid evidence_mode {claim.get('evidence_mode')!r}")
        if claim.get("confidence") not in CONFIDENCE_LEVELS:
            errors.append(f"{label}: invalid confidence {claim.get('confidence')!r}")
        if claim.get("ai_use") not in AI_USES:
            errors.append(f"{label}: invalid ai_use {claim.get('ai_use')!r}")
        check_date(claim.get("observed_at"), f"{label}.observed_at", errors)
        if not isinstance(claim.get("notes"), str):
            errors.append(f"{label}: notes must be a string")
        validate_time(claim.get("valid_time"), f"{label}.valid_time", errors)

        evidence = claim.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{label}: evidence must be a non-empty array")
        else:
            for evidence_index, item in enumerate(evidence, start=1):
                evidence_label = f"{label}.evidence[{evidence_index}]"
                if not isinstance(item, dict):
                    errors.append(f"{evidence_label}: expected object")
                    continue
                check_required(item, EVIDENCE_REQUIRED, evidence_label, errors)
                check_allowed(item, EVIDENCE_REQUIRED, evidence_label, errors)
                if item.get("source_id") not in source_ids:
                    errors.append(
                        f"{evidence_label}: unknown source_id {item.get('source_id')!r}"
                    )
                if item.get("support") not in SUPPORT_TYPES:
                    errors.append(
                        f"{evidence_label}: invalid support {item.get('support')!r}"
                    )
                check_non_empty_string(
                    item.get("locator"), f"{evidence_label}.locator", errors
                )

        conflict_id = claim.get("conflict_group_id")
        if conflict_id is not None:
            if not isinstance(conflict_id, str) or not CONFLICT_ID_RE.fullmatch(conflict_id):
                errors.append(f"{label}: invalid conflict_group_id {conflict_id!r}")
            else:
                conflict_ids.append(conflict_id)

        if claim.get("evidence_mode") == "unknown" and claim.get("ai_use") == "grounding":
            errors.append(f"{label}: unknown evidence cannot be grounding")
        valid_time = claim.get("valid_time")
        if (
            isinstance(valid_time, dict)
            and valid_time.get("status") == "target"
            and claim.get("ai_use") == "grounding"
        ):
            errors.append(f"{label}: target value cannot be grounding")

    check_unique(claim_ids, "claim_id", errors)
    check_contiguous_ids(claim_ids, "CLM-", "claim_id", errors)
    for conflict_id, count in Counter(conflict_ids).items():
        if count < 2:
            errors.append(f"{conflict_id}: conflict group must contain at least two claims")


def validate_products(
    products: list[dict[str, Any]], source_ids: set[str], errors: list[str]
) -> None:
    product_ids: list[str] = []
    snapshot_keys: list[tuple[str, str, str]] = []

    for index, product in enumerate(products, start=1):
        label = f"product[{index}]"
        check_required(product, PRODUCT_REQUIRED, label, errors)
        check_allowed(
            product,
            PRODUCT_REQUIRED | PRODUCT_OPTIONAL,
            label,
            errors,
        )
        product_id = product.get("product_id")
        if not isinstance(product_id, str) or not PRODUCT_ID_RE.fullmatch(product_id):
            errors.append(f"{label}: invalid product_id {product_id!r}")
        else:
            product_ids.append(product_id)
        style_number = product.get("style_number")
        check_non_empty_string(style_number, f"{label}.style_number", errors)
        market = product.get("market")
        if not isinstance(market, str) or not MARKET_RE.fullmatch(market):
            errors.append(f"{label}: invalid market {market!r}")
        observed_at = product.get("observed_at")
        if (
            isinstance(style_number, str)
            and isinstance(market, str)
            and isinstance(observed_at, str)
        ):
            snapshot_keys.append((style_number, market, observed_at))
        if product.get("record_type") != "product_snapshot":
            errors.append(f"{label}: record_type must be 'product_snapshot'")
        check_non_empty_string(product.get("name"), f"{label}.name", errors)
        check_non_empty_string(
            product.get("silhouette"), f"{label}.silhouette", errors
        )
        for nullable_string_field in (
            "family",
            "collection_or_season",
            "pattern_family",
            "product_made_in",
        ):
            nullable_value = product.get(nullable_string_field)
            if nullable_value is not None and not isinstance(nullable_value, str):
                errors.append(
                    f"{label}.{nullable_string_field}: expected string or null"
                )
        if product.get("confidence") not in CONFIDENCE_LEVELS:
            errors.append(f"{label}: invalid confidence {product.get('confidence')!r}")
        check_date(product.get("observed_at"), f"{label}.observed_at", errors)
        if not isinstance(product.get("notes"), str):
            errors.append(f"{label}: notes must be a string")

        product_sources = product.get("source_ids")
        if not isinstance(product_sources, list) or not product_sources:
            errors.append(f"{label}: source_ids must be a non-empty array")
        else:
            for source_id in product_sources:
                if source_id not in source_ids:
                    errors.append(f"{label}: unknown source_id {source_id!r}")
            if len(product_sources) != len(set(product_sources)):
                errors.append(f"{label}: duplicate source_ids")

        product_evidence = product.get("evidence")
        evidence_source_ids: list[str] = []
        if not isinstance(product_evidence, list) or not product_evidence:
            errors.append(f"{label}: evidence must be a non-empty array")
        else:
            for evidence_index, item in enumerate(product_evidence, start=1):
                evidence_label = f"{label}.evidence[{evidence_index}]"
                if not isinstance(item, dict):
                    errors.append(f"{evidence_label}: expected object")
                    continue
                check_required(item, EVIDENCE_REQUIRED, evidence_label, errors)
                check_allowed(item, EVIDENCE_REQUIRED, evidence_label, errors)
                source_id = item.get("source_id")
                if source_id not in source_ids:
                    errors.append(f"{evidence_label}: unknown source_id {source_id!r}")
                elif isinstance(source_id, str):
                    evidence_source_ids.append(source_id)
                if item.get("support") not in SUPPORT_TYPES:
                    errors.append(
                        f"{evidence_label}: invalid support {item.get('support')!r}"
                    )
                check_non_empty_string(
                    item.get("locator"), f"{evidence_label}.locator", errors
                )
        if isinstance(product_sources, list) and set(product_sources) != set(
            evidence_source_ids
        ):
            errors.append(f"{label}: source_ids and evidence source IDs must match")

        components = product.get("components")
        if not isinstance(components, list) or not components:
            errors.append(f"{label}: components must be a non-empty array")
        else:
            component_roles: list[str] = []
            for component_index, component in enumerate(components, start=1):
                component_label = f"{label}.components[{component_index}]"
                if not isinstance(component, dict):
                    errors.append(f"{component_label}: expected object")
                    continue
                check_required(component, COMPONENT_REQUIRED, component_label, errors)
                check_allowed(component, COMPONENT_REQUIRED, component_label, errors)
                if component.get("role") not in COMPONENT_ROLES:
                    errors.append(
                        f"{component_label}: invalid role {component.get('role')!r}"
                    )
                else:
                    component_roles.append(component["role"])
                material_class = component.get("material_class")
                if material_class not in MATERIAL_CLASSES:
                    errors.append(
                        f"{component_label}: invalid material_class {material_class!r}"
                    )
                check_non_empty_string(
                    component.get("material_label"),
                    f"{component_label}.material_label",
                    errors,
                )
                attribute_state = component.get("attribute_state")
                if not isinstance(attribute_state, dict):
                    errors.append(f"{component_label}.attribute_state: expected object")
                else:
                    check_required(
                        attribute_state,
                        ATTRIBUTE_FIELDS,
                        f"{component_label}.attribute_state",
                        errors,
                    )
                    check_allowed(
                        attribute_state,
                        ATTRIBUTE_FIELDS,
                        f"{component_label}.attribute_state",
                        errors,
                    )
                    for field in sorted(ATTRIBUTE_FIELDS):
                        value = component.get(field)
                        state = attribute_state.get(field)
                        if value is not None and not isinstance(value, str):
                            errors.append(
                                f"{component_label}.{field}: expected string or null"
                            )
                        if state not in ATTRIBUTE_STATES:
                            errors.append(
                                f"{component_label}.attribute_state.{field}: "
                                f"invalid state {state!r}"
                            )
                        elif value is None and state == "reported":
                            errors.append(
                                f"{component_label}.{field}: null value cannot be reported"
                            )
                        elif value is not None and state != "reported":
                            errors.append(
                                f"{component_label}.{field}: non-null value must be reported"
                            )
                    if (
                        material_class in {"leather", "regenerated_leather"}
                        and attribute_state.get("coating_polymer") == "not_applicable"
                    ):
                        errors.append(
                            f"{component_label}: leather coating_polymer must be "
                            "reported or unknown, not not_applicable"
                        )
                grain = component.get("grain_structure")
                if isinstance(grain, str) and "nappa" in grain.lower():
                    errors.append(
                        f"{component_label}: nappa belongs in leather_type, not grain_structure"
                    )
            if component_roles.count("body") != 1:
                errors.append(f"{label}: exactly one body component is required")

        construction_features = product.get("construction_features")
        if construction_features is not None:
            if not isinstance(construction_features, list):
                errors.append(f"{label}: construction_features must be an array")
            else:
                for feature_index, feature in enumerate(
                    construction_features, start=1
                ):
                    check_non_empty_string(
                        feature,
                        f"{label}.construction_features[{feature_index}]",
                        errors,
                    )

        composition_claims = product.get("composition_claims")
        if composition_claims is not None:
            if not isinstance(composition_claims, list) or not composition_claims:
                errors.append(f"{label}: composition_claims must be a non-empty array")
            else:
                for claim_index, composition_claim in enumerate(
                    composition_claims, start=1
                ):
                    check_non_empty_string(
                        composition_claim,
                        f"{label}.composition_claims[{claim_index}]",
                        errors,
                    )

        measurements = product.get("measurements")
        if measurements is not None:
            if not isinstance(measurements, list) or not measurements:
                errors.append(f"{label}: measurements must be a non-empty array")
            else:
                for measurement_index, measurement in enumerate(
                    measurements, start=1
                ):
                    measurement_label = (
                        f"{label}.measurements[{measurement_index}]"
                    )
                    if not isinstance(measurement, dict):
                        errors.append(f"{measurement_label}: expected object")
                        continue
                    check_required(
                        measurement,
                        MEASUREMENT_REQUIRED,
                        measurement_label,
                        errors,
                    )
                    check_allowed(
                        measurement,
                        MEASUREMENT_REQUIRED,
                        measurement_label,
                        errors,
                    )
                    if measurement.get("kind") not in MEASUREMENT_KINDS:
                        errors.append(
                            f"{measurement_label}: invalid kind "
                            f"{measurement.get('kind')!r}"
                        )
                    check_non_empty_string(
                        measurement.get("raw_value"),
                        f"{measurement_label}.raw_value",
                        errors,
                    )
                    if measurement.get("unit") != "cm":
                        errors.append(f"{measurement_label}: unit must be 'cm'")
                    values = measurement.get("values")
                    if not isinstance(values, list) or not values:
                        errors.append(
                            f"{measurement_label}: values must be a non-empty array"
                        )
                        values = []
                    else:
                        for value_index, number in enumerate(values, start=1):
                            if (
                                not isinstance(number, (int, float))
                                or isinstance(number, bool)
                                or number <= 0
                            ):
                                errors.append(
                                    f"{measurement_label}.values[{value_index}]: "
                                    "expected a positive number"
                                )
                    value_order = measurement.get("value_order")
                    if value_order not in MEASUREMENT_VALUE_ORDERS:
                        errors.append(
                            f"{measurement_label}: invalid value_order {value_order!r}"
                        )
                    elif value_order == "single" and len(values) != 1:
                        errors.append(
                            f"{measurement_label}: single requires exactly one value"
                        )
                    elif value_order == "min_max":
                        if len(values) != 2:
                            errors.append(
                                f"{measurement_label}: min_max requires exactly two values"
                            )
                        elif values[0] > values[1]:
                            errors.append(
                                f"{measurement_label}: min_max values must be ascending"
                            )
                    if not isinstance(measurement.get("notes"), str):
                        errors.append(f"{measurement_label}: notes must be a string")

    check_unique(product_ids, "product_id", errors)
    check_contiguous_ids(product_ids, "PRD-", "product_id", errors)
    check_unique(snapshot_keys, "(style_number, market, observed_at)", errors)


def is_official_mcm_page(value: str) -> bool:
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    return (
        parsed.scheme == "https"
        and bool(host)
        and (host == "mcmworldwide.com" or host.endswith(".mcmworldwide.com"))
    )


def validate_image_registry(
    images: list[dict[str, Any]],
    source_urls: dict[str, str],
    source_dates: dict[str, tuple[Any, Any]],
    registry_label: str,
    allowed_subject_types: set[str],
    errors: list[str],
) -> tuple[list[str], list[str], list[str], list[str]]:
    image_ids: list[str] = []
    asset_ids: list[str] = []
    image_urls: list[str] = []
    content_hashes: list[str] = []

    if not images:
        errors.append(f"{registry_label}: registry must contain at least one record")
        return image_ids, asset_ids, image_urls, content_hashes

    for index, record in enumerate(images, start=1):
        label = f"{registry_label}[{index}]"
        check_required(record, IMAGE_REQUIRED, label, errors)
        check_allowed(record, IMAGE_REQUIRED | IMAGE_OPTIONAL, label, errors)

        image_id = record.get("image_id")
        if not isinstance(image_id, str) or not IMAGE_ID_RE.fullmatch(image_id):
            errors.append(f"{label}: invalid image_id {image_id!r}")
        else:
            image_ids.append(image_id)

        if record.get("record_type") != "image_reference":
            errors.append(f"{label}: record_type must be 'image_reference'")

        subject_type = record.get("subject_type")
        if subject_type not in {"pattern", "material", "editorial_context"}:
            errors.append(f"{label}: invalid subject_type {subject_type!r}")
        elif isinstance(image_id, str):
            expected_prefix = {
                "pattern": "PIMG-",
                "material": "MIMG-",
                "editorial_context": "CIMG-",
            }[subject_type]
            if not image_id.startswith(expected_prefix):
                errors.append(
                    f"{label}: {subject_type} image_id must start with {expected_prefix}"
                )
        if subject_type not in allowed_subject_types:
            errors.append(
                f"{label}: subject_type {subject_type!r} is not allowed in "
                f"{registry_label}"
            )

        check_non_empty_string(record.get("subject"), f"{label}.subject", errors)
        style_number = record.get("style_number")
        if style_number is not None:
            check_non_empty_string(style_number, f"{label}.style_number", errors)
        market = record.get("market")
        if not isinstance(market, str) or not MARKET_RE.fullmatch(market):
            errors.append(f"{label}: invalid market {market!r}")

        tags = record.get("tags")
        if not isinstance(tags, list) or not tags:
            errors.append(f"{label}: tags must be a non-empty array")
        else:
            for tag_index, tag in enumerate(tags, start=1):
                check_non_empty_string(tag, f"{label}.tags[{tag_index}]", errors)
            if len(tags) != len(set(tags)):
                errors.append(f"{label}: tags must be unique")

        asset_id = record.get("asset_id")
        check_non_empty_string(asset_id, f"{label}.asset_id", errors)
        if isinstance(asset_id, str):
            asset_ids.append(asset_id)

        image_url = record.get("image_url")
        if not isinstance(image_url, str):
            errors.append(f"{label}: image_url must be a string")
        else:
            parsed_image = urlparse(image_url)
            if parsed_image.scheme != "https" or not parsed_image.netloc:
                errors.append(f"{label}: image_url must be an absolute HTTPS URL")
            elif parsed_image.hostname not in OFFICIAL_PAGE_IMAGE_HOSTS:
                errors.append(
                    f"{label}: image_url host is not an approved official-page image host"
                )
            image_urls.append(image_url)

        source_page_url = record.get("source_page_url")
        if not isinstance(source_page_url, str):
            errors.append(f"{label}: source_page_url must be a string")
        elif not is_official_mcm_page(source_page_url):
            errors.append(
                f"{label}: source_page_url must be an official MCM HTTPS page"
            )

        source_id = record.get("source_id")
        if source_id not in source_urls:
            errors.append(f"{label}: unknown source_id {source_id!r}")
        elif source_page_url != source_urls[source_id]:
            errors.append(
                f"{label}: source_page_url must exactly match {source_id} URL "
                f"{source_urls[source_id]!r}"
            )

        redirected_from = record.get("source_page_redirected_from")
        if redirected_from is not None:
            if not isinstance(redirected_from, str) or not is_official_mcm_page(
                redirected_from
            ):
                errors.append(
                    f"{label}: source_page_redirected_from must be null or an "
                    "official MCM HTTPS page"
                )
            elif redirected_from == source_page_url:
                errors.append(
                    f"{label}: redirected URL must differ from canonical source page"
                )

        check_non_empty_string(record.get("caption"), f"{label}.caption", errors)
        raw_alt_text = record.get("raw_alt_text")
        if raw_alt_text is not None and (
            not isinstance(raw_alt_text, str) or not raw_alt_text.strip()
        ):
            errors.append(f"{label}: raw_alt_text must be null or non-empty text")

        published_at = record.get("published_at")
        check_date(published_at, f"{label}.published_at", errors, True)
        precision = record.get("date_precision")
        if precision not in IMAGE_DATE_PRECISIONS:
            errors.append(f"{label}: invalid date_precision {precision!r}")
        elif published_at is None and precision != "unknown":
            errors.append(f"{label}: null published_at requires unknown precision")
        elif published_at is not None and precision == "unknown":
            errors.append(f"{label}: dated record requires known date_precision")

        date_basis = record.get("date_basis")
        if date_basis not in IMAGE_DATE_BASES:
            errors.append(f"{label}: invalid date_basis {date_basis!r}")
        elif published_at is None and date_basis != "unknown":
            errors.append(f"{label}: null published_at requires unknown date_basis")
        elif published_at is not None and date_basis == "unknown":
            errors.append(f"{label}: dated record requires a known date_basis")
        if date_basis == "source_page_publication" and source_id in source_dates:
            source_published_at, source_precision = source_dates[source_id]
            if published_at != source_published_at or precision != source_precision:
                errors.append(
                    f"{label}: source_page_publication date must exactly match "
                    f"{source_id} published_at/date_precision"
                )

        check_date(record.get("observed_at"), f"{label}.observed_at", errors)
        check_date(record.get("checked_at"), f"{label}.checked_at", errors)
        observed_at = record.get("observed_at")
        checked_at = record.get("checked_at")
        if (
            isinstance(observed_at, str)
            and isinstance(checked_at, str)
            and checked_at < observed_at
        ):
            errors.append(f"{label}: checked_at must not precede observed_at")

        if record.get("http_status") != 200:
            errors.append(f"{label}: http_status must be 200")
        if record.get("content_type") not in IMAGE_CONTENT_TYPES:
            errors.append(
                f"{label}: invalid content_type {record.get('content_type')!r}"
            )
        check_non_empty_string(
            record.get("verification_method"),
            f"{label}.verification_method",
            errors,
        )
        if record.get("channel_status") != "mcm_official_channel":
            errors.append(
                f"{label}: channel_status must be 'mcm_official_channel'"
            )
        if record.get("rights_status") != "unknown_reference_only":
            errors.append(
                f"{label}: rights_status must be 'unknown_reference_only'"
            )
        if record.get("association_confidence") not in IMAGE_ASSOCIATION_CONFIDENCE:
            errors.append(
                f"{label}: invalid association_confidence "
                f"{record.get('association_confidence')!r}"
            )
        tag_evidence_mode = record.get("tag_evidence_mode")
        if tag_evidence_mode not in IMAGE_TAG_EVIDENCE_MODES:
            errors.append(
                f"{label}: invalid tag_evidence_mode {tag_evidence_mode!r}"
            )
        if subject_type == "editorial_context" and tag_evidence_mode != "context_only":
            errors.append(
                f"{label}: editorial context must use context_only tag evidence"
            )
        if subject_type != "editorial_context" and tag_evidence_mode == "context_only":
            errors.append(
                f"{label}: context_only tag evidence requires editorial_context"
            )

        content_sha256 = record.get("content_sha256")
        if content_sha256 is not None:
            if not isinstance(content_sha256, str) or not re.fullmatch(
                r"[0-9a-f]{64}", content_sha256
            ):
                errors.append(f"{label}: invalid content_sha256")
            else:
                content_hashes.append(content_sha256)
        response_bytes = record.get("response_bytes")
        if response_bytes is not None and (
            not isinstance(response_bytes, int)
            or isinstance(response_bytes, bool)
            or response_bytes <= 0
        ):
            errors.append(f"{label}: response_bytes must be a positive integer")
        if not isinstance(record.get("notes"), str):
            errors.append(f"{label}: notes must be a string")

    return image_ids, asset_ids, image_urls, content_hashes


def validate_images(
    pattern_images: list[dict[str, Any]],
    material_images: list[dict[str, Any]],
    source_urls: dict[str, str],
    source_dates: dict[str, tuple[Any, Any]],
    errors: list[str],
) -> None:
    pattern_result = validate_image_registry(
        pattern_images,
        source_urls,
        source_dates,
        "pattern_image",
        {"pattern", "editorial_context"},
        errors,
    )
    material_result = validate_image_registry(
        material_images,
        source_urls,
        source_dates,
        "material_image",
        {"material"},
        errors,
    )
    all_image_ids = pattern_result[0] + material_result[0]
    all_asset_ids = pattern_result[1] + material_result[1]
    all_image_urls = pattern_result[2] + material_result[2]
    all_content_hashes = pattern_result[3] + material_result[3]
    check_unique(all_image_ids, "image_id", errors)
    check_contiguous_ids(
        [image_id for image_id in all_image_ids if image_id.startswith("PIMG-")],
        "PIMG-",
        "pattern image_id",
        errors,
    )
    check_contiguous_ids(
        [image_id for image_id in all_image_ids if image_id.startswith("CIMG-")],
        "CIMG-",
        "editorial context image_id",
        errors,
    )
    check_contiguous_ids(
        [image_id for image_id in all_image_ids if image_id.startswith("MIMG-")],
        "MIMG-",
        "material image_id",
        errors,
    )
    check_unique(all_asset_ids, "image asset_id", errors)
    check_unique(all_image_urls, "image_url", errors)
    check_unique(all_content_hashes, "image content_sha256", errors)


def main() -> int:
    errors: list[str] = []
    schema = load_json(SCHEMA_PATH, errors)
    if not isinstance(schema, dict) or "$defs" not in schema:
        errors.append(f"{SCHEMA_PATH}: expected schema with $defs")

    sources = load_json(SOURCE_PATH, errors)
    claims = load_jsonl(CLAIM_PATH, errors)
    products = load_jsonl(PRODUCT_PATH, errors)
    pattern_images = load_jsonl(PATTERN_IMAGE_PATH, errors)
    material_images = load_jsonl(MATERIAL_IMAGE_PATH, errors)

    validate_records_against_schema(sources, schema, "source", errors)
    validate_records_against_schema(claims, schema, "claim", errors)
    validate_records_against_schema(products, schema, "product", errors)
    validate_records_against_schema(
        pattern_images, schema, "pattern_image", errors
    )
    validate_records_against_schema(
        material_images, schema, "material_image", errors
    )

    source_urls = validate_sources(sources, errors)
    source_ids = set(source_urls)
    source_dates = {
        source["source_id"]: (source.get("published_at"), source.get("date_precision"))
        for source in sources
        if isinstance(source, dict) and source.get("source_id") in source_ids
    }
    validate_claims(claims, source_ids, errors)
    validate_products(products, source_ids, errors)
    validate_images(
        pattern_images,
        material_images,
        source_urls,
        source_dates,
        errors,
    )

    if errors:
        print("MCM leather knowledge validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    conflict_count = len(
        {
            claim["conflict_group_id"]
            for claim in claims
            if claim.get("conflict_group_id") is not None
        }
    )
    image_type_counts = Counter(
        image.get("subject_type") for image in pattern_images + material_images
    )
    print(
        "Validated MCM leather knowledge: "
        f"{len(sources)} sources, {len(claims)} claims, "
        f"{len(products)} products, {image_type_counts['pattern']} pattern images, "
        f"{image_type_counts['material']} material images, "
        f"{image_type_counts['editorial_context']} editorial context images, "
        f"{conflict_count} conflict groups."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
