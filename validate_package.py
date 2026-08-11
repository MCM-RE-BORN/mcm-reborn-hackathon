#!/usr/bin/env python3
"""Lightweight validation for the MCM RE:BORN hackathon package."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent


def walk_refs(value: Any, path: str = '$') -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f'{path}.{key}'
            if key == '$ref' and isinstance(child, str):
                refs.append((child, child_path))
            refs.extend(walk_refs(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            refs.extend(walk_refs(child, f'{path}[{index}]'))
    return refs


def resolve_local_ref(document: dict[str, Any], ref: str) -> Any:
    if not ref.startswith('#/'):
        return None
    current: Any = document
    for segment in ref[2:].split('/'):
        segment = segment.replace('~1', '/').replace('~0', '~')
        current = current[segment]
    return current


def main() -> None:
    openapi_path = ROOT / 'openapi.yaml'
    mock_path = ROOT / 'mock-data.json'
    schema_path = ROOT / 'supabase-schema.sql'
    prompt_path = ROOT / 'prompts' / 'bag-analysis.system.txt'
    provider_example_path = ROOT / 'examples' / 'openai-analysis.ts'

    openapi = yaml.safe_load(openapi_path.read_text(encoding='utf-8'))
    mock = json.loads(mock_path.read_text(encoding='utf-8'))
    sql = schema_path.read_text(encoding='utf-8')
    prompt = prompt_path.read_text(encoding='utf-8')
    provider_example = provider_example_path.read_text(encoding='utf-8')

    if openapi.get('openapi') != '3.1.0':
        raise SystemExit('openapi.yaml must use OpenAPI 3.1.0')
    if openapi.get('info', {}).get('version') != '1.1.0':
        raise SystemExit('openapi.yaml package contract version must be 1.1.0')
    if mock.get('meta', {}).get('version') != openapi['info']['version']:
        raise SystemExit('Mock package version must match the OpenAPI contract version')

    missing_refs: list[tuple[str, str]] = []
    for ref, ref_path in walk_refs(openapi):
        if ref.startswith('#/'):
            try:
                resolve_local_ref(openapi, ref)
            except (KeyError, TypeError):
                missing_refs.append((ref, ref_path))
    if missing_refs:
        raise SystemExit(f'Missing OpenAPI refs: {missing_refs}')

    operation_ids: list[str] = []
    http_methods = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'}
    for path_item in openapi['paths'].values():
        for method, operation in path_item.items():
            if method.lower() in http_methods:
                operation_ids.append(operation['operationId'])
    duplicates = [key for key, count in Counter(operation_ids).items() if count > 1]
    if duplicates:
        raise SystemExit(f'Duplicate operationIds: {duplicates}')

    expected_products = {'REBORN_POUCH', 'REBORN_CARD_WALLET', 'REBORN_KEYRING'}
    products = [item for item in mock['products'] if item.get('active')]
    actual_products = {item['code'] for item in products}
    if actual_products != expected_products:
        raise SystemExit(
            f'Active product codes must be {sorted(expected_products)}; got {sorted(actual_products)}'
        )

    for product in products:
        for label, value in {
            'listImage.url': product.get('listImage', {}).get('url'),
            'model3d.url': product.get('model3d', {}).get('url'),
            'model3d.posterUrl': product.get('model3d', {}).get('posterUrl'),
        }.items():
            if not value:
                raise SystemExit(f"{product['code']} missing {label}")

    expected_quality_codes = {
        'BLUR',
        'TOO_DARK',
        'TOO_BRIGHT',
        'GLARE',
        'PRODUCT_CROPPED',
        'INSUFFICIENT_DETAIL',
        'MIXED_PRODUCTS',
    }
    schemas = openapi['components']['schemas']
    actual_quality_codes = set(schemas['ImageQualityIssueCode']['enum'])
    if actual_quality_codes != expected_quality_codes:
        raise SystemExit(
            'Image quality issue codes do not match the approved MVP contract: '
            f'{sorted(actual_quality_codes)}'
        )
    image_quality_schema = schemas['ImageQualityAssessment']
    issue_schema = schemas['ImageQualityIssue']
    if image_quality_schema['properties']['issues'].get('maxItems') != 7:
        raise SystemExit('OpenAPI image-quality issues must be limited to seven')
    if issue_schema['properties']['guidanceKo'].get('maxLength') != 120:
        raise SystemExit('OpenAPI recapture guidance must be limited to 120 characters')

    analysis_422 = openapi['paths']['/analyses']['post']['responses']['422']
    if analysis_422.get('$ref') != '#/components/responses/ImageQualityInsufficient':
        raise SystemExit('POST /analyses must expose the recapture-required 422 response')

    application_422 = openapi['paths']['/applications']['post']['responses']['422']
    if application_422.get('$ref') != '#/components/responses/AuthenticityReviewRequired':
        raise SystemExit('POST /applications must expose the review-required 422 response')

    application_statuses = set(schemas['ApplicationStatus']['enum'])
    if 'AUTHENTICITY_REVIEW_REQUIRED' in application_statuses:
        raise SystemExit(
            'AUTHENTICITY_REVIEW_REQUIRED is a pre-application gate, not an application status'
        )

    analyses = mock.get('analysisFixtures', [])
    for analysis in analyses:
        image_quality = analysis.get('imageQuality', {})
        if image_quality.get('status') != 'ACCEPTABLE' or image_quality.get('issues') != []:
            raise SystemExit(
                f"Successful analysis {analysis.get('scenarioKey')} must have ACCEPTABLE image quality"
            )

    recapture_fixtures = [
        item
        for item in mock.get('analysisErrorFixtures', [])
        if item.get('scenarioKey') == 'LOW_QUALITY_RECAPTURE'
    ]
    if len(recapture_fixtures) != 1:
        raise SystemExit('Exactly one LOW_QUALITY_RECAPTURE fixture is required')
    recapture = recapture_fixtures[0]
    recapture_error = recapture.get('error', {})
    recapture_details = recapture_error.get('details', {})
    recapture_quality = recapture_details.get('imageQuality', {})
    recapture_issues = recapture_quality.get('issues', [])
    if (
        recapture.get('httpStatus') != 422
        or recapture_error.get('code') != 'IMAGE_QUALITY_INSUFFICIENT'
        or recapture_quality.get('status') != 'RECAPTURE_REQUIRED'
        or recapture_details.get('retryable') is not True
        or not recapture_issues
    ):
        raise SystemExit('LOW_QUALITY_RECAPTURE fixture does not match the 422 contract')
    issue_codes = {issue.get('code') for issue in recapture_issues}
    if not issue_codes <= expected_quality_codes:
        raise SystemExit(f'Unknown recapture issue codes: {sorted(issue_codes)}')
    if any(not issue.get('assetId') or not issue.get('guidanceKo') for issue in recapture_issues):
        raise SystemExit('Every recapture issue needs assetId and guidanceKo')

    review_analysis_ids = {
        analysis['id']
        for analysis in analyses
        if analysis.get('authenticitySignal') == 'REVIEW_REQUIRED'
    }
    application_analysis_ids = {
        application['analysisId'] for application in mock.get('applications', [])
    }
    blocked_application_ids = review_analysis_ids & application_analysis_ids
    if blocked_application_ids:
        raise SystemExit(
            'REVIEW_REQUIRED analyses must not have applications: '
            f'{sorted(blocked_application_ids)}'
        )

    manual_review_cases = mock.get('manualReviewCases', [])
    manual_review_analysis_ids = {case.get('analysisId') for case in manual_review_cases}
    if (
        manual_review_analysis_ids != review_analysis_ids
        or len(manual_review_cases) != len(review_analysis_ids)
    ):
        raise SystemExit('Every REVIEW_REQUIRED analysis needs exactly one manual review case')
    if any(
        case.get('status') != 'PENDING'
        or case.get('reasonCode') != 'AUTHENTICITY_REVIEW_REQUIRED'
        or case.get('applicationCreationBlocked') is not True
        for case in manual_review_cases
    ):
        raise SystemExit('Manual review cases must be pending and block application creation')

    application_status_sql = sql.split(
        'create type public.application_status as enum (', 1
    )[1].split(');', 1)[0]
    if 'AUTHENTICITY_REVIEW_REQUIRED' in application_status_sql:
        raise SystemExit('SQL application_status must not contain the pre-application gate')
    sql_application_statuses = set(re.findall(r"'([A-Z_]+)'", application_status_sql))
    if sql_application_statuses != application_statuses:
        raise SystemExit(
            'SQL and OpenAPI application statuses differ: '
            f'SQL={sorted(sql_application_statuses)}, '
            f'OpenAPI={sorted(application_statuses)}'
        )

    required_sql_fragments = {
        'manual review table': 'create table public.manual_review_cases',
        'review gate trigger': "if analysis_authenticity_signal = 'REVIEW_REQUIRED' then",
        'review gate error': "raise exception 'AUTHENTICITY_REVIEW_REQUIRED:",
        'owner path constraint': 'constraint media_assets_owner_path',
        'direct-write privilege boundary': 'revoke all privileges on table',
        'server-only metadata grant': 'to service_role;',
        'private source object policy': 'create policy source_products_owner_read',
        'operator catalog write policy': 'create policy catalog_assets_operator_insert',
    }
    missing_sql_fragments = [
        label for label, fragment in required_sql_fragments.items() if fragment not in sql
    ]
    if missing_sql_fragments:
        raise SystemExit(f'Missing SQL security invariants: {missing_sql_fragments}')

    forbidden_direct_write_fragments = [
        'create policy media_assets_operator_insert on public.media_assets',
        'create policy analyses_operator_insert on public.analyses',
        'create policy analyses_operator_update on public.analyses',
        'create policy applications_operator_insert on public.applications',
        'create policy applications_operator_update on public.applications',
        'create policy manual_review_cases_operator_insert on public.manual_review_cases',
        'create policy manual_review_cases_operator_update on public.manual_review_cases',
        'grant insert, update, delete on table public.media_assets to authenticated',
        'grant insert, update on table public.analyses, public.applications to authenticated',
        'grant insert, update, delete on table public.manual_review_cases to authenticated',
    ]
    present_direct_write_fragments = [
        fragment for fragment in forbidden_direct_write_fragments if fragment in sql
    ]
    if present_direct_write_fragments:
        raise SystemExit(
            'Sensitive table writes must stay server-only: '
            f'{present_direct_write_fragments}'
        )

    required_provider_fragments = [
        'ImageQualityInsufficientError',
        'imageIndex:',
        'guidanceKo:',
        "status === 'RECAPTURE_REQUIRED'",
        'isImageQualityInsufficient',
        'assertImageQualityContract',
        'AI_OUTPUT_INVALID_ACCEPTABLE_WITH_ISSUES',
        'AI_OUTPUT_INVALID_RECAPTURE_WITHOUT_ISSUES',
        'AI_OUTPUT_INVALID_IMAGE_INDEX',
    ]
    if any(fragment not in provider_example for fragment in required_provider_fragments):
        raise SystemExit('OpenAI provider example is missing the recapture contract')
    if 'Never declare an item authentic or counterfeit.' not in prompt:
        raise SystemExit('System prompt must keep authenticity as review-only')

    print(
        'OK:',
        f"{len(openapi['paths'])} paths,",
        f'{len(operation_ids)} operations,',
        f"{len(openapi['components']['schemas'])} schemas,",
        f'{len(products)} active products with list image + 3D assets,',
        f'{len(recapture_fixtures)} recapture fixture,',
        f'{len(manual_review_cases)} blocked manual-review case.',
    )


if __name__ == '__main__':
    main()
