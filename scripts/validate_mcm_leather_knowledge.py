#!/usr/bin/env python3
"""Validate the provenance-aware MCM leather-bag research dataset.

The validator deliberately uses only the Python standard library so the
research snapshot can be checked without installing a JSON Schema package.
It covers the invariants that matter most for retrieval: parseability,
identity, dates, source links, conflict groups, and product component shape.
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
SCHEMA_PATH = KB_ROOT / "schema" / "knowledge-record.schema.json"

SOURCE_ID_RE = re.compile(r"^SRC-[0-9]{3}$")
CLAIM_ID_RE = re.compile(r"^CLM-[0-9]{3}$")
PRODUCT_ID_RE = re.compile(r"^PRD-[0-9]{3}$")
CONFLICT_ID_RE = re.compile(r"^CONFLICT-[0-9]{3}$")
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
    "alternative_material",
    "decoration",
    "unknown",
}
ATTRIBUTE_STATES = {"reported", "unknown", "not_applicable"}


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


def validate_sources(sources: Any, errors: list[str]) -> set[str]:
    if not isinstance(sources, list):
        errors.append(f"{SOURCE_PATH}: root must be an array")
        return set()

    source_ids: list[str] = []
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
    return set(source_ids)


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
            PRODUCT_REQUIRED | {"construction_features", "composition_claims"},
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
        if product.get("confidence") not in CONFIDENCE_LEVELS:
            errors.append(f"{label}: invalid confidence {product.get('confidence')!r}")
        check_date(product.get("observed_at"), f"{label}.observed_at", errors)

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
                grain = component.get("grain_structure")
                if isinstance(grain, str) and "nappa" in grain.lower():
                    errors.append(
                        f"{component_label}: nappa belongs in leather_type, not grain_structure"
                    )

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

    check_unique(product_ids, "product_id", errors)
    check_unique(snapshot_keys, "(style_number, market, observed_at)", errors)


def main() -> int:
    errors: list[str] = []
    schema = load_json(SCHEMA_PATH, errors)
    if not isinstance(schema, dict) or "$defs" not in schema:
        errors.append(f"{SCHEMA_PATH}: expected schema with $defs")

    sources = load_json(SOURCE_PATH, errors)
    claims = load_jsonl(CLAIM_PATH, errors)
    products = load_jsonl(PRODUCT_PATH, errors)

    source_ids = validate_sources(sources, errors)
    validate_claims(claims, source_ids, errors)
    validate_products(products, source_ids, errors)

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
    print(
        "Validated MCM leather knowledge: "
        f"{len(sources)} sources, {len(claims)} claims, "
        f"{len(products)} products, {conflict_count} conflict groups."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
