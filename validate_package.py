#!/usr/bin/env python3
"""Cross-file contract validation for MCM RE:BORN API package v2.0.0."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent

ANALYSIS_STATUSES = {
    'RECEIVED',
    'ANALYZING',
    'SUPPLEMENT_REQUIRED',
    'COMPLETED',
    'FAILED',
}
ANALYSIS_MODES = {'DEMO_FIXTURE', 'SEEDED_ESTIMATE', 'LIVE'}
APPLICATION_STATUSES = {
    'PENDING_PAYMENT',
    'ORDER_PLACED',
    'PICKUP_SCHEDULED',
    'PICKUP_IN_PROGRESS',
    'PRODUCT_RECEIVED',
    'EXPERT_INSPECTION',
    'PRODUCTION_READY',
    'CHANGE_APPROVAL_REQUIRED',
    'IN_PRODUCTION',
    'QUALITY_CHECK',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'PRODUCTION_UNAVAILABLE',
    'CANCELED',
}
PRODUCT_CODES = {
    'REBORN_PASSPORT_WALLET',
    'REBORN_CARD_WALLET',
    'REBORN_NAME_TAG',
    'REBORN_KEYRING',
}
UPLOAD_PURPOSES = {'SOURCE_FRONT', 'SOURCE_SIDE', 'INTERIOR', 'ENGRAVING'}
PRIMARY_SCENARIO_KEY = 'MCM_BACKPACK_CHANGE_APPROVED_20260817'
INSPECTION_OUTCOMES = {'NO_CHANGE', 'CHANGE_REQUIRED', 'PRODUCTION_UNAVAILABLE'}


def fail(message: str) -> None:
    raise SystemExit(message)


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
    current: Any = document
    for segment in ref[2:].split('/'):
        current = current[segment.replace('~1', '/').replace('~0', '~')]
    return current


def sql_enum(sql: str, name: str) -> set[str]:
    pattern = rf'create\s+type\s+public\.{re.escape(name)}\s+as\s+enum\s*\((.*?)\);'
    match = re.search(pattern, sql, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        fail(f'SQL enum public.{name} is missing')
    return set(re.findall(r"'([A-Z_]+)'", match.group(1)))


def require_fragments(text: str, label: str, fragments: dict[str, str]) -> None:
    missing = [name for name, fragment in fragments.items() if fragment not in text]
    if missing:
        fail(f'{label} is missing required contract fragments: {missing}')


def validate_openapi(openapi: dict[str, Any]) -> tuple[int, int]:
    if openapi.get('openapi') != '3.1.0':
        fail('openapi.yaml must use OpenAPI 3.1.0')
    if openapi.get('info', {}).get('version') != '2.0.0':
        fail('openapi.yaml contract version must be breaking v2.0.0')
    if any('/api/v1' in server.get('url', '') for server in openapi.get('servers', [])):
        fail('OpenAPI servers must not expose the v1 base path')

    missing_refs: list[tuple[str, str]] = []
    for ref, ref_path in walk_refs(openapi):
        if ref.startswith('#/'):
            try:
                resolve_local_ref(openapi, ref)
            except (KeyError, TypeError):
                missing_refs.append((ref, ref_path))
    if missing_refs:
        fail(f'Missing OpenAPI refs: {missing_refs}')

    operation_ids: list[str] = []
    methods = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'}
    for path_item in openapi['paths'].values():
        for method, operation in path_item.items():
            if method.lower() in methods:
                operation_ids.append(operation['operationId'])
    duplicates = [key for key, count in Counter(operation_ids).items() if count > 1]
    if duplicates:
        fail(f'Duplicate operationIds: {duplicates}')

    schemas = openapi['components']['schemas']
    if set(schemas['UploadPurpose']['enum']) != UPLOAD_PURPOSES:
        fail('OpenAPI UploadPurpose enum differs from the v2 source-photo contract')
    upload_file = schemas['UploadFileRequest']['properties']
    if set(upload_file['contentType']['enum']) != {'image/jpeg', 'image/png'}:
        fail('Source uploads must accept only image/jpeg and image/png')
    if upload_file['sizeBytes'].get('maximum') != 10_485_760:
        fail('Source upload maximum must be 10485760 bytes')
    presign_files = schemas['PresignUploadRequest']['properties']['files']
    if (presign_files.get('minItems'), presign_files.get('maxItems')) != (1, 4):
        fail('Presign must support incremental batches of one to four files')

    create_analysis = schemas['CreateAnalysisRequest']
    image_ids = create_analysis['properties']['imageAssetIds']
    if (image_ids.get('minItems'), image_ids.get('maxItems')) != (3, 4):
        fail('CreateAnalysisRequest must require three to four source photos')
    required_input = {
        'imageAssetIds',
        'locale',
        'category',
        'purchaseYear',
        'useDuration',
        'desiredUse',
    }
    if set(create_analysis['required']) != required_input:
        fail(f'CreateAnalysisRequest required fields must be {sorted(required_input)}')
    if {'serialNumber', 'conditionNote'} & set(create_analysis['required']):
        fail('serialNumber and conditionNote must remain optional')
    scenario_enum = create_analysis['properties']['demoScenarioKey']['enum']
    if PRIMARY_SCENARIO_KEY not in scenario_enum or 'PRIMARY_REBORN_BACKPACK' in scenario_enum:
        fail('CreateAnalysisRequest must expose only the canonical v2 primary scenario key')

    if set(schemas['AnalysisStatus']['enum']) != ANALYSIS_STATUSES:
        fail('OpenAPI AnalysisStatus differs from v2')
    if set(schemas['AnalysisModeUsed']['enum']) != ANALYSIS_MODES:
        fail('OpenAPI estimate modes differ from v2')
    if set(schemas['AiMode']['enum']) != ANALYSIS_MODES:
        fail('OpenAPI health AI modes must use the same v2 estimate mode vocabulary')
    if set(schemas['AuthenticityPrecheckStatus']['enum']) != {
        'ORDER_ELIGIBLE',
        'INELIGIBLE',
    }:
        fail('OpenAPI authenticity precheck statuses differ from v2')

    estimate_meta = schemas['EstimateMeta']
    if set(estimate_meta['required']) != {'mode', 'confidencePercent', 'notice'}:
        fail('EstimateMeta must require mode, confidencePercent, and notice')
    analysis_required = set(schemas['Analysis']['required'])
    for field in (
        'estimateMeta',
        'authenticityPrecheck',
        'estimatedReusableMaterialRate',
    ):
        if field not in analysis_required:
            fail(f'Analysis must require {field}')
    if 'estimateMeta' not in set(schemas['AnalysisListItem']['required']):
        fail('AnalysisListItem must require estimateMeta')

    if set(schemas['ProductCode']['enum']) != PRODUCT_CODES:
        fail('OpenAPI product codes differ from the final four-product catalog')
    if 'estimatedReusableMaterialRate' not in schemas['AnalysisRecommendation']['required']:
        fail('Each recommended product must expose its estimated reusable rate')
    if set(schemas['InspectionOutcome']['enum']) != INSPECTION_OUTCOMES:
        fail('OpenAPI inspection outcomes differ from the canonical SSOT')
    if schemas['EsgPreview']['properties']['methodologyVersion'].get('const') != 'DEMO_LCA_V2':
        fail('Analysis ESG preview methodology must be DEMO_LCA_V2')
    if schemas['EsgCertificate']['properties']['methodologyVersion'].get('const') != 'DEMO_LCA_V2':
        fail('Certificate methodology must be DEMO_LCA_V2')
    if schemas['ImageAsset']['properties']['aspectRatio'].get('pattern') != '^[1-9][0-9]*:[1-9][0-9]*$':
        fail('Product image contract must support the intrinsic ratio of canonical assets')
    if set(schemas['ApplicationStatus']['enum']) != APPLICATION_STATUSES:
        fail('OpenAPI ApplicationStatus differs from v2')
    if set(schemas['ApplicationExceptionStatus']['enum']) != {
        'PRODUCTION_UNAVAILABLE',
        'CANCELED',
    }:
        fail('statusOverride must be limited to v2 exception states')

    required_paths = {
        '/admin/applications/{applicationId}/inspection': 'post',
        '/applications/{applicationId}/change-request': 'get',
        '/applications/{applicationId}/change-request/approve': 'post',
        '/applications/{applicationId}/change-request/reject': 'post',
    }
    for path, method in required_paths.items():
        if method not in openapi['paths'].get(path, {}):
            fail(f'Missing v2 order inspection API: {method.upper()} {path}')

    application_responses = openapi['paths']['/applications']['post']['responses']
    if any('AuthenticityReviewRequired' in str(value) for value in application_responses.values()):
        fail('POST /applications must not expose the removed pre-order review response')
    analysis_422 = openapi['paths']['/analyses']['post']['responses'].get('422', {})
    if analysis_422.get('$ref') != '#/components/responses/ImageQualityInsufficient':
        fail('POST /analyses must preserve the recapture-required 422 response')

    return len(operation_ids), len(schemas)


def validate_mock(mock: dict[str, Any], version: str) -> tuple[int, int]:
    if mock.get('meta', {}).get('version') != version:
        fail('Mock version must match OpenAPI v2.0.0')
    if mock.get('meta', {}).get('contractChange') != 'BREAKING':
        fail('Mock metadata must declare the v2 contract as BREAKING')
    if 'manualReviewCases' in mock:
        fail('manualReviewCases was removed in v2')

    upload = mock.get('uploadContract', {})
    if set(upload.get('contentTypes', [])) != {'image/jpeg', 'image/png'}:
        fail('Mock upload MIME contract differs from OpenAPI')
    if upload.get('maxFileSizeBytes') != 10_485_760:
        fail('Mock upload maximum must be 10485760 bytes')
    if set(upload.get('purposes', [])) != UPLOAD_PURPOSES:
        fail('Mock upload purposes differ from OpenAPI')
    if upload.get('presignFileCount') != {'min': 1, 'max': 4}:
        fail('Mock presign count must be 1..4')
    if upload.get('analysisFileCount') != {'min': 3, 'max': 4}:
        fail('Mock analysis count must be 3..4')

    products = [item for item in mock.get('products', []) if item.get('active')]
    if {item.get('code') for item in products} != PRODUCT_CODES:
        fail('Mock must expose exactly the final four active product codes')
    for product in products:
        for path, value in {
            'listImage.url': product.get('listImage', {}).get('url'),
            'model3d.url': product.get('model3d', {}).get('url'),
            'model3d.posterUrl': product.get('model3d', {}).get('posterUrl'),
        }.items():
            if not value:
                fail(f"{product.get('code')} is missing {path}")
    product_by_code = {item['code']: item for item in products}
    expected_catalog = {
        'REBORN_PASSPORT_WALLET': ('passport-wallet', 'RE:BORN 여권지갑', 180_000, '3~4주'),
        'REBORN_CARD_WALLET': ('card-wallet', 'RE:BORN 카드지갑', 150_000, '2~3주'),
        'REBORN_NAME_TAG': ('luggage-name-tag', 'RE:BORN 캐리어 네임택', 95_000, '약 2주'),
        'REBORN_KEYRING': ('keyring', 'RE:BORN 키링', 75_000, '1~2주'),
    }
    for code, (ui_id, name, amount, duration) in expected_catalog.items():
        product = product_by_code[code]
        actual = (
            product.get('uiId'),
            product.get('name'),
            product.get('mockPrice', {}).get('amount'),
            product.get('estimatedDuration'),
        )
        if actual != (ui_id, name, amount, duration):
            fail(f'{code} differs from canonical UI catalog: {actual}')
    expected_square_assets = {
        'REBORN_NAME_TAG': '/assets/mvp-beta/recommendation-luggage-name-tag-v2.webp',
        'REBORN_KEYRING': '/assets/mvp-beta/recommendation-keyring-v2.webp',
    }
    for code, url in expected_square_assets.items():
        image = product_by_code[code]['listImage']
        if (
            image.get('url') != url
            or image.get('width') != 600
            or image.get('height') != 600
            or image.get('aspectRatio') != '1:1'
        ):
            fail(f'{code} must use the canonical 600x600 v2 WebP asset')
    expected_portrait_assets = {
        'REBORN_PASSPORT_WALLET': '/assets/mvp-beta/recommendation-passport-wallet.png',
        'REBORN_CARD_WALLET': '/assets/mvp-beta/recommendation-card-holder.png',
    }
    for code, url in expected_portrait_assets.items():
        image = product_by_code[code]['listImage']
        if (
            image.get('url') != url
            or image.get('width') != 250
            or image.get('height') != 271
            or image.get('aspectRatio') != '250:271'
        ):
            fail(f'{code} must use the canonical 250x271 PNG asset')

    analyses = mock.get('analysisFixtures', [])
    for analysis in analyses:
        if analysis.get('status') not in ANALYSIS_STATUSES:
            fail(f"Unknown analysis status in {analysis.get('scenarioKey')}")
        meta = analysis.get('estimateMeta', {})
        if set(meta) != {'mode', 'confidencePercent', 'notice'}:
            fail(f"{analysis.get('scenarioKey')} must have complete estimateMeta")
        if meta.get('mode') not in ANALYSIS_MODES or analysis.get('modeUsed') != meta.get('mode'):
            fail(f"{analysis.get('scenarioKey')} estimate mode is inconsistent")
        precheck = analysis.get('authenticityPrecheck', {})
        if precheck.get('status') not in {'ORDER_ELIGIBLE', 'INELIGIBLE'}:
            fail(f"{analysis.get('scenarioKey')} has invalid authenticityPrecheck")
        if not isinstance(precheck.get('estimatePercent'), int) or not precheck.get('notice'):
            fail(f"{analysis.get('scenarioKey')} has incomplete authenticityPrecheck")
        if 'estimatedReusableMaterialRate' not in analysis:
            fail(f"{analysis.get('scenarioKey')} lacks estimatedReusableMaterialRate")

    primary_analyses = [
        item for item in analyses if item.get('scenarioKey') == PRIMARY_SCENARIO_KEY
    ]
    if len(primary_analyses) != 1:
        fail('Exactly one canonical primary analysis fixture is required')
    primary_analysis = primary_analyses[0]
    if primary_analysis.get('submissionNumber') != 'SUB-RB-20260817-0001':
        fail('Primary analysis must use the canonical submission number')
    if primary_analysis.get('inputProductInfo') != {
        'category': 'BACKPACK',
        'purchaseYear': 2019,
        'useDuration': '5년 이상',
        'desiredUse': '여권지갑',
        'conditionNote': '하단 모서리에 가벼운 마모가 있어요.',
    }:
        fail('Primary analysis product input differs from the canonical UI values')
    if primary_analysis.get('condition') != {
        'grade': 'A',
        'overallDamageSeverity': 18,
        'summary': '외부 패널은 양호하고 하단 모서리에 가벼운 사용감이 보여요.',
    }:
        fail('Primary analysis condition differs from the canonical UI values')
    if (
        primary_analysis.get('estimatedReusableMaterialRate') != 72
        or primary_analysis.get('estimateMeta', {}).get('confidencePercent') != 87
        or primary_analysis.get('authenticityPrecheck', {}).get('estimatePercent') != 91
        or primary_analysis.get('provider', {}).get('model') != PRIMARY_SCENARIO_KEY
    ):
        fail('Primary AI estimate differs from the canonical 72/87/91 scenario')
    if primary_analysis.get('esgPreview', {}).get('methodologyVersion') != 'DEMO_LCA_V2':
        fail('Primary analysis ESG preview must use DEMO_LCA_V2')
    recommendation_rates = {
        item.get('productCode'): item.get('estimatedReusableMaterialRate')
        for item in primary_analysis.get('recommendations', [])
    }
    if recommendation_rates != {
        'REBORN_PASSPORT_WALLET': 72,
        'REBORN_CARD_WALLET': 64,
        'REBORN_NAME_TAG': 38,
        'REBORN_KEYRING': 24,
    }:
        fail('Primary recommendation rates differ from the canonical UI scenario')

    recaptures = [
        item
        for item in mock.get('analysisErrorFixtures', [])
        if item.get('scenarioKey') == 'LOW_QUALITY_RECAPTURE'
    ]
    if len(recaptures) != 1:
        fail('Exactly one LOW_QUALITY_RECAPTURE fixture is required')
    recapture = recaptures[0]
    quality = recapture.get('error', {}).get('details', {}).get('imageQuality', {})
    if (
        recapture.get('httpStatus') != 422
        or recapture.get('error', {}).get('code') != 'IMAGE_QUALITY_INSUFFICIENT'
        or quality.get('status') != 'RECAPTURE_REQUIRED'
        or not quality.get('issues')
    ):
        fail('LOW_QUALITY_RECAPTURE fixture differs from the 422 contract')

    primary = mock.get('primaryScenario', {})
    expected_primary = {
        'scenarioKey': PRIMARY_SCENARIO_KEY,
        'submissionNumber': 'SUB-RB-20260817-0001',
        'orderId': '30000000-0000-4000-8000-000000000001',
        'orderNumber': 'RB-20260817-0001',
        'analysisId': '20000000-0000-4000-8000-000000000001',
        'productId': '10000000-0000-4000-8000-000000000001',
    }
    for key, expected in expected_primary.items():
        if primary.get(key) != expected:
            fail(f'primaryScenario.{key} must be {expected}')
    if primary.get('source') != {
        'brand': 'MCM',
        'name': 'MCM 비세토스 모노그램 백팩',
        'category': 'BACKPACK',
        'images': [
            {'purpose': 'SOURCE_FRONT', 'url': '/assets/mvp-beta/source-backpack-front.webp'},
            {'purpose': 'SOURCE_SIDE', 'url': '/assets/mvp-beta/source-backpack-side.webp'},
            {'purpose': 'INTERIOR', 'url': '/assets/mvp-beta/source-backpack-interior.webp'},
            {'purpose': 'ENGRAVING', 'url': '/assets/mvp-beta/source-backpack-engraving.webp'},
        ],
    }:
        fail('Primary source must be the canonical MCM Visetos monogram backpack')
    initial = primary.get('initialEstimate', {})
    if (
        initial.get('estimatedReusableMaterialRate') != 72
        or initial.get('confidencePercent') != 87
        or initial.get('authenticityPrecheckPercent') != 91
        or initial.get('amountKrw') != 180_000
        or initial.get('estimatedDuration') != '3~4주'
    ):
        fail('Primary initial estimate differs from the approved scenario')
    inspection = primary.get('postPickupInspection', {})
    if (
        inspection.get('outcome') != 'CHANGE_REQUIRED'
        or inspection.get('reason')
        != '사진에서 보이지 않던 내부 원단 손상이 확인되어 재단 범위를 조정했어요.'
        or inspection.get('confirmedReusableMaterialRate') != 68
        or inspection.get('amountKrw') != 195_000
        or inspection.get('estimatedDuration') != '4~5주'
        or inspection.get('changeDecision') != 'APPROVED'
    ):
        fail('Primary post-pickup inspection differs from the approved scenario')
    final = primary.get('finalCertificate', {})
    if final != {
        'certificateNumber': 'ESG-RB-20260817-0001',
        'reusedMaterialRate': 68,
        'reusedAreaCm2': 2860,
        'estimatedCarbonSavingKgCo2e': 3.43,
        'methodologyVersion': 'DEMO_LCA_V2',
    }:
        fail('Primary final certificate summary differs from the approved scenario')

    applications = mock.get('applications', [])
    if len(applications) != 1:
        fail('The canonical demo must use exactly one application/order record')
    application = applications[0]
    if (
        application.get('id') != primary['orderId']
        or application.get('applicationNumber') != primary['orderNumber']
        or application.get('analysisId') != primary['analysisId']
        or application.get('productId') != primary['productId']
    ):
        fail('Canonical application IDs differ from primaryScenario')

    payments = mock.get('mockPayments', [])
    if len(payments) != 1 or payments[0].get('applicationStatusAfterPayment') != 'ORDER_PLACED':
        fail('Successful demo payment must transition to ORDER_PLACED')

    expected_history = [
        'PENDING_PAYMENT',
        'ORDER_PLACED',
        'PICKUP_SCHEDULED',
        'PICKUP_IN_PROGRESS',
        'PRODUCT_RECEIVED',
        'EXPERT_INSPECTION',
        'CHANGE_APPROVAL_REQUIRED',
        'PRODUCTION_READY',
        'IN_PRODUCTION',
        'QUALITY_CHECK',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
    ]
    history = mock.get('applicationStatusHistory', [])
    if [item.get('status') for item in history] != expected_history:
        fail('Primary order status history differs from the approved change-approval path')
    if any(item.get('applicationId') != primary['orderId'] for item in history):
        fail('All primary status history entries must use the single canonical orderId')

    physical = mock.get('physicalInspections', [])
    changes = mock.get('applicationChangeRequests', [])
    if len(physical) != 1 or len(changes) != 1:
        fail('Primary scenario requires one physical inspection and one change request')
    if (
        physical[0].get('applicationId') != primary['orderId']
        or physical[0].get('outcome') != 'CHANGE_REQUIRED'
        or physical[0].get('reason')
        != '사진에서 보이지 않던 내부 원단 손상이 확인되어 재단 범위를 조정했어요.'
        or physical[0].get('confirmedReusableMaterialRate') != 68
        or physical[0].get('confirmedReusableAreaCm2') != 2860
    ):
        fail('Physical inspection fixture differs from the primary scenario')
    if changes[0].get('status') != 'APPROVED' or changes[0].get('applicationId') != primary['orderId']:
        fail('Primary changed terms must be customer-approved')

    certificates = mock.get('certificates', [])
    if len(certificates) != 1:
        fail('Primary scenario requires exactly one final certificate')
    certificate = certificates[0]
    if (
        certificate.get('certificateNumber') != 'ESG-RB-20260817-0001'
        or certificate.get('applicationId') != primary['orderId']
        or certificate.get('reusedMaterialRate') != 68
        or certificate.get('reusedAreaCm2') != 2860
        or certificate.get('estimatedCarbonSavingKgCo2e') != 3.43
        or certificate.get('methodologyVersion') != 'DEMO_LCA_V2'
    ):
        fail('Final certificate fixture differs from the approved scenario')

    return len(products), len(recaptures)


def validate_sql(sql: str) -> None:
    expected_enums = {
        'upload_purpose': UPLOAD_PURPOSES,
        'analysis_status': ANALYSIS_STATUSES,
        'analysis_mode_used': ANALYSIS_MODES,
        'authenticity_precheck_status': {'ORDER_ELIGIBLE', 'INELIGIBLE'},
        'application_status': APPLICATION_STATUSES,
        'inspection_outcome': INSPECTION_OUTCOMES,
    }
    for enum_name, expected in expected_enums.items():
        actual = sql_enum(sql, enum_name)
        if actual != expected:
            fail(f'SQL {enum_name} differs: expected={sorted(expected)}, actual={sorted(actual)}')

    require_fragments(
        sql,
        'supabase-schema.sql',
        {
            '10 MiB source limit': 'size_bytes <= 10485760',
            'JPG/PNG source MIME': "mime_type in ('image/jpeg', 'image/png')",
            'product input purchase year': 'purchase_year integer not null',
            'three-to-four photo DB guard': 'analysis requires 3 to 4 uploaded owner photos',
            'estimate confidence': 'estimate_confidence_percent integer check',
            'estimated reusable rate': 'estimated_reusable_material_rate integer check',
            'recommendation reusable rate': 'estimated_reusable_material_rate integer not null',
            'completed estimate payload': 'constraint completed_analysis_payload_required',
            'ESG methodology v2': "methodology_version = 'DEMO_LCA_V2'",
            'physical inspections': 'create table public.physical_inspections',
            'change requests': 'create table public.application_change_requests',
            'state transition guard': 'create or replace function public.enforce_application_transition()',
            'production approval guard': 'IN_PRODUCTION requires completed inspection and approved changed terms',
            'payment transition': "set persisted_status = 'ORDER_PLACED'",
            'immutable changed terms': 'customer decision cannot alter proposed terms',
            'customer decision trigger': 'create or replace function public.apply_change_request_decision()',
            'private owner path': 'constraint media_assets_owner_path',
            'row-level security': 'alter table public.application_change_requests enable row level security;',
        },
    )

    forbidden = [
        'manual_review_cases',
        'authenticity_signal',
        'PENDING_APPROVAL',
        'RECEIVING_PRODUCT',
        'ADDITIONAL_REVIEW_REQUIRED',
        'FIXTURE_FALLBACK',
        'image/webp',
        '6291456',
        'DEMO_LCA_V1',
        'UNCHANGED',
        'CHANGES_PROPOSED',
    ]
    present = [fragment for fragment in forbidden if fragment in sql]
    if present:
        fail(f'SQL still contains removed v1 contract fragments: {present}')


def validate_prompt_and_examples(
    prompt: str,
    provider: str,
    recommendation: str,
    mock_status: str,
) -> None:
    require_fragments(
        prompt,
        'bag-analysis.system.txt',
        {
            'v2 precheck field': 'authenticityPrecheck',
            'eligible status': 'ORDER_ELIGIBLE',
            'ineligible status': 'INELIGIBLE',
            'official-decision disclaimer': 'not an official authenticity determination or guarantee',
            'three-to-four image rule': 'three or four supplied images',
        },
    )
    require_fragments(
        provider,
        'openai-analysis.ts',
        {
            'precheck schema': 'authenticityPrecheck: z.object',
            'canonical scenario key': PRIMARY_SCENARIO_KEY,
            'v2 modes': "mode: 'LIVE'",
            'estimate confidence': 'confidencePercent:',
            'three-image minimum': 'imageUrls.length < 3',
            'recapture error': 'ImageQualityInsufficientError',
        },
    )
    require_fragments(
        recommendation,
        'recommendation.ts',
        {
            'estimated rate': 'estimatedReusableMaterialRate',
            'seeded mode': "mode: 'SEEDED_ESTIMATE'",
            'passport wallet': 'REBORN_PASSPORT_WALLET',
            'name tag': 'REBORN_NAME_TAG',
            'ESG methodology': 'DEMO_LCA_V2',
        },
    )
    require_fragments(
        mock_status,
        'mock-status.ts',
        {
            'canonical scenario key': PRIMARY_SCENARIO_KEY,
            'no-change outcome': "'NO_CHANGE'",
            'change-required outcome': "'CHANGE_REQUIRED'",
            'approved change guard': "changeRequestStatus === 'APPROVED'",
        },
    )
    for label, text in {'prompt': prompt, 'provider example': provider}.items():
        present = [
            term
            for term in ('authenticitySignal', 'REVIEW_REQUIRED', 'NOT_EVALUATED')
            if term in text
        ]
        if present:
            fail(f'{label} still contains removed v1 authenticity terms: {present}')


def validate_guide(guide: str) -> None:
    marker = '## 11. v1 → v2 마이그레이션 이력'
    if marker not in guide:
        fail('API guide must isolate v1 terms in a migration-history section')
    current_guidance = guide.split(marker, 1)[0]
    forbidden_current = [
        'PENDING_APPROVAL',
        'REVIEW_REQUIRED',
        'ADDITIONAL_REVIEW_REQUIRED',
        '파일당 6MB',
        'JPG/PNG/WebP',
        '2주 MVP',
        'Phase2',
    ]
    present = [term for term in forbidden_current if term in current_guidance]
    if present:
        fail(f'API guide uses v1 guidance outside migration history: {present}')
    for fragment in (
        PRIMARY_SCENARIO_KEY,
        'CHANGE_REQUIRED',
        'NO_CHANGE',
        'DEMO_LCA_V2',
        'SUB-RB-20260817-0001',
    ):
        if fragment not in current_guidance:
            fail(f'API guide is missing canonical v2 value: {fragment}')


def validate_readme_and_env(readme: str, env_example: str) -> None:
    forbidden_current = [
        'REVIEW_REQUIRED',
        'PENDING_APPROVAL',
        'FAST_DEMO',
        'AI_MODE=hybrid',
    ]
    present = [term for term in forbidden_current if term in readme or term in env_example]
    if present:
        fail(f'README/.env.example still contains active v1 guidance: {present}')
    require_fragments(
        env_example,
        '.env.example',
        {
            'v2 analysis mode': 'AI_MODE=DEMO_FIXTURE',
            'primary demo profile': 'DEMO_TIMELINE_PROFILE=PRIMARY_SCENARIO',
            'canonical scenario': f'DEMO_SCENARIO_KEY={PRIMARY_SCENARIO_KEY}',
            'mode vocabulary': '# DEMO_FIXTURE | SEEDED_ESTIMATE | LIVE',
        },
    )


def main() -> None:
    openapi = yaml.safe_load((ROOT / 'openapi.yaml').read_text(encoding='utf-8'))
    mock = json.loads((ROOT / 'mock-data.json').read_text(encoding='utf-8'))
    sql = (ROOT / 'supabase-schema.sql').read_text(encoding='utf-8')
    guide = (ROOT / 'MCM_REBORN_API_GUIDE.md').read_text(encoding='utf-8')
    prompt = (ROOT / 'prompts' / 'bag-analysis.system.txt').read_text(encoding='utf-8')
    provider = (ROOT / 'examples' / 'openai-analysis.ts').read_text(encoding='utf-8')
    recommendation = (ROOT / 'examples' / 'recommendation.ts').read_text(encoding='utf-8')
    mock_status = (ROOT / 'examples' / 'mock-status.ts').read_text(encoding='utf-8')
    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    env_example = (ROOT / '.env.example').read_text(encoding='utf-8')

    operation_count, schema_count = validate_openapi(openapi)
    product_count, recapture_count = validate_mock(mock, openapi['info']['version'])
    validate_sql(sql)
    validate_prompt_and_examples(prompt, provider, recommendation, mock_status)
    validate_guide(guide)
    validate_readme_and_env(readme, env_example)

    print(
        'OK: v2.0.0 breaking contract;',
        f'{len(openapi["paths"])} paths,',
        f'{operation_count} operations,',
        f'{schema_count} schemas,',
        f'{product_count} products,',
        f'{recapture_count} recapture fixture,',
        'one canonical order RB-20260817-0001.',
    )


if __name__ == '__main__':
    main()
