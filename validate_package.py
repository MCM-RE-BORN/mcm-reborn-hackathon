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
ANALYSIS_CAPTURE_SLOTS = [
    'FRONT',
    'REAR',
    'TOP',
    'BOTTOM',
    'LEFT_SIDE',
    'RIGHT_SIDE',
]
PRIMARY_SCENARIO_KEY = 'MCM_BACKPACK_CHANGE_APPROVED_20260817'
INSPECTION_OUTCOMES = {'NO_CHANGE', 'CHANGE_REQUIRED', 'PRODUCTION_UNAVAILABLE'}
LIFECYCLE_COMMAND_TARGET_STATUSES = {
    'PICKUP_SCHEDULED',
    'PICKUP_IN_PROGRESS',
    'PRODUCT_RECEIVED',
    'EXPERT_INSPECTION',
    'IN_PRODUCTION',
    'QUALITY_CHECK',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'PRODUCTION_UNAVAILABLE',
    'CANCELED',
}
CANONICAL_PICKUP_SCHEDULE = {
    'requestedDate': '2026-08-19',
    'timeWindow': '14:00-16:00',
}
CANONICAL_CONSENTS = {
    'serviceAndPrivacyTermsAccepted': True,
    'aiEstimateNoticeAccepted': True,
    'inspectionChangeNoticeAccepted': True,
}
ANALYTICS_EVENT_NAMES = {
    'ANALYSIS_STARTED',
    'ANALYSIS_COMPLETED',
    'ANALYSIS_FALLBACK_USED',
    'PRODUCT_LIST_VIEWED',
    'PRODUCT_DETAIL_VIEWED',
    'APPLICATION_CREATED',
    'MOCK_PAYMENT_COMPLETED',
    'PHYSICAL_INSPECTION_COMPLETED',
    'APPLICATION_CHANGE_APPROVED',
    'APPLICATION_CHANGE_REJECTED',
    'CERTIFICATE_VIEWED',
}
CANONICAL_MOCK_SHIPMENT = {
    'applicationId': '30000000-0000-4000-8000-000000000001',
    'carrierCode': 'MCM_REBORN_DEMO',
    'carrierName': 'MCM RE:BORN Demo Logistics',
    'trackingNumber': 'DEMO-RB-20260817-0001',
    'trackingUrl': None,
    'status': 'DELIVERED',
}
PRODUCT_3D_REQUIRED_FIELDS = {
    'format',
    'url',
    'posterUrl',
    'cameraOrbit',
    'cameraTarget',
    'fieldOfView',
    'autoRotate',
    'availableVariants',
}
CANONICAL_PRODUCT_3D = {
    'REBORN_PASSPORT_WALLET': {
        'format': 'GLB',
        'url': '/assets/models/passport-wallet.glb',
        'posterUrl': '/assets/products/passport-wallet/poster.webp',
        'environmentImageUrl': '/assets/3d/studio.hdr',
        'cameraOrbit': '0deg 75deg 105%',
        'cameraTarget': '0m 0m 0m',
        'fieldOfView': '30deg',
        'autoRotate': True,
        'availableVariants': [{'key': 'COGNAC_GOLD', 'label': '코냑·골드'}],
    },
    'REBORN_CARD_WALLET': {
        'format': 'GLB',
        'url': '/assets/models/card-wallet.glb',
        'posterUrl': '/assets/products/card-wallet/poster.webp',
        'environmentImageUrl': '/assets/3d/studio.hdr',
        'cameraOrbit': '20deg 75deg 110%',
        'cameraTarget': '0m 0m 0m',
        'fieldOfView': '28deg',
        'autoRotate': True,
        'availableVariants': [{'key': 'COGNAC_GOLD', 'label': '코냑·골드'}],
    },
    'REBORN_NAME_TAG': {
        'format': 'GLB',
        'url': '/assets/models/name-tag.glb',
        'posterUrl': '/assets/products/name-tag/poster.webp',
        'environmentImageUrl': '/assets/3d/studio.hdr',
        'cameraOrbit': '0deg 75deg 110%',
        'cameraTarget': '0m 0m 0m',
        'fieldOfView': '28deg',
        'autoRotate': True,
        'availableVariants': [{'key': 'GOLD', 'label': '골드'}],
    },
    'REBORN_KEYRING': {
        'format': 'GLB',
        'url': '/assets/models/keyring.glb',
        'posterUrl': '/assets/products/keyring/poster.webp',
        'environmentImageUrl': '/assets/3d/studio.hdr',
        'cameraOrbit': '0deg 75deg 115%',
        'cameraTarget': '0m 0m 0m',
        'fieldOfView': '25deg',
        'autoRotate': True,
        'availableVariants': [{'key': 'GOLD_RING', 'label': '골드 링'}],
    },
}
CANONICAL_PRODUCT_OPTION_GROUPS = {
    'REBORN_PASSPORT_WALLET': [
        {
            'key': 'edgeColor',
            'label': '엣지 색상',
            'required': True,
            'type': 'SELECT',
            'options': [
                {
                    'value': 'COGNAC',
                    'label': '코냑',
                    'modelVariant': 'COGNAC_GOLD',
                },
            ],
        },
        {
            'key': 'initials',
            'label': '이니셜',
            'required': False,
            'type': 'TEXT',
            'maxLength': 3,
        },
    ],
    'REBORN_CARD_WALLET': [],
    'REBORN_NAME_TAG': [],
    'REBORN_KEYRING': [],
}


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


def sql_function_block(sql: str, name: str, label: str) -> str:
    pattern = (
        rf'create\s+or\s+replace\s+function\s+public\.{re.escape(name)}'
        rf'\s*\([^)]*\).*?\$\$.*?\$\$;'
    )
    match = re.search(pattern, sql, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        fail(f'{label} is missing public.{name}()')
    return match.group(0)


def validate_runtime_trigger_contract(sql: str, label: str) -> None:
    payment = sql_function_block(sql, 'apply_successful_mock_payment', label)
    require_fragments(
        payment,
        f'{label} payment trigger',
        {
            'guarded payment update': "persisted_status = 'PENDING_PAYMENT'",
            'zero-row failure': 'if not found then',
            'payment conflict error': (
                'successful mock payment requires a PENDING_PAYMENT application'
            ),
            'integrity SQLSTATE': "using errcode = '23514'",
        },
    )

    change_decision = sql_function_block(
        sql,
        'apply_change_request_decision',
        label,
    )
    require_fragments(
        change_decision,
        f'{label} change-decision trigger',
        {
            'definer rights': 'security definer',
            'fixed search path': 'set search_path = public, pg_temp',
            'authenticated actor': 'decision_user_id uuid := auth.uid()',
            'pending-only decision': "old.status <> 'PENDING'",
            'same-status rejection': 'new.status is not distinct from old.status',
            'application ownership': 'a.customer_id = decision_user_id',
            'identity binding': 'new.responded_by is distinct from decision_user_id',
            'guarded application state': (
                "a.persisted_status = 'CHANGE_APPROVAL_REQUIRED'"
            ),
            'permission SQLSTATE': "using errcode = '42501'",
        },
    )
    if (
        'revoke all on function public.apply_change_request_decision()'
        not in sql
    ):
        fail(f'{label} must revoke direct execute on the definer trigger')
    require_fragments(
        sql,
        f'{label} change-decision trigger scope',
        {
            'prepare every update': (
                'application_change_requests_prepare_decision\n'
                'before update on public.application_change_requests'
            ),
            'apply every update': (
                'application_change_requests_apply_decision\n'
                'after update on public.application_change_requests'
            ),
        },
    )


def validate_analytics_rpc_contract(sql: str, label: str) -> None:
    record_event = sql_function_block(sql, 'record_analytics_event', label)
    require_fragments(
        record_event,
        f'{label} analytics event RPC',
        {
            'definer rights': 'security definer',
            'fixed search path': 'set search_path = public, pg_temp',
            'per-user transaction lock': (
                'pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))'
            ),
            'rolling 60-second window': (
                "ae.received_at >= clock_timestamp() - interval '60 seconds'"
            ),
            '60-event cap': 'recent_event_count >= 60',
            'rate-limit error': 'analytics event rate limit exceeded',
            'rate-limit SQLSTATE': "using errcode = 'P0001'",
            'atomic insert': 'insert into public.analytics_events',
            'post-lock receive time': 'clock_timestamp()',
            'created event ID': 'returning id into created_event_id',
        },
    )
    require_fragments(
        sql,
        f'{label} analytics event privileges',
        {
            'no direct table insert': (
                'revoke insert on public.analytics_events\n'
                'from public, anon, authenticated, service_role;'
            ),
            'RPC public revoke': (
                'revoke all on function public.record_analytics_event('
            ),
            'RPC service grant': (
                'grant execute on function public.record_analytics_event('
            ),
        },
    )


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
    if (image_ids.get('minItems'), image_ids.get('maxItems')) != (6, 6):
        fail('CreateAnalysisRequest must require exactly six source photos')
    if image_ids.get('uniqueItems') is not True:
        fail('CreateAnalysisRequest imageAssetIds must be unique')
    if image_ids.get('description') != (
        '정면, 후면, 상단, 하단, 좌측면, 우측면 촬영 자산 ID만 이 순서로 전달합니다. '
        '여섯 슬롯은 모두 필수이며 배열 0~1은 SOURCE_FRONT, 2~5는 SOURCE_SIDE purpose여야 합니다. '
        'INTERIOR·ENGRAVING 자산과 일련번호 사진은 포함하지 않습니다.'
    ):
        fail('CreateAnalysisRequest must define the six ordered capture slots and their purposes')
    analysis_description = openapi['paths']['/analyses']['post'].get('description', '')
    for fragment in (
        '배열 0~1의 purpose는 SOURCE_FRONT, 2~5는 SOURCE_SIDE여야 합니다.',
        'INTERIOR 또는 ENGRAVING 자산과 일련번호 사진은 imageAssetIds에 포함하지 않습니다.',
        'serialNumber는 신규 분석 접수에 필수이며',
        'ASCII 영문·숫자 11자리여야 합니다.',
    ):
        if fragment not in analysis_description:
            fail('POST /analyses must enforce directional purposes and exclude the serial photo')
    required_input = {
        'imageAssetIds',
        'locale',
        'category',
        'purchaseYear',
        'useDuration',
        'desiredUse',
        'serialNumber',
    }
    if set(create_analysis['required']) != required_input:
        fail(f'CreateAnalysisRequest required fields must be {sorted(required_input)}')
    if 'conditionNote' in set(create_analysis['required']):
        fail('conditionNote must remain optional')
    serial_number = create_analysis['properties']['serialNumber']
    if (serial_number.get('minLength'), serial_number.get('maxLength')) != (11, 11):
        fail('CreateAnalysisRequest serialNumber must be exactly 11 characters')
    if serial_number.get('pattern') != r'^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{11}$':
        fail('CreateAnalysisRequest serialNumber must require ASCII letters and digits')
    scenario_enum = create_analysis['properties']['demoScenarioKey']['enum']
    if PRIMARY_SCENARIO_KEY not in scenario_enum or 'PRIMARY_REBORN_BACKPACK' in scenario_enum:
        fail('CreateAnalysisRequest must expose only the canonical v2 primary scenario key')

    if set(schemas['AnalysisStatus']['enum']) != ANALYSIS_STATUSES:
        fail('OpenAPI AnalysisStatus differs from v2')
    if set(schemas['AnalysisModeUsed']['enum']) != ANALYSIS_MODES:
        fail('OpenAPI estimate modes differ from v2')
    if set(schemas['AiMode']['enum']) != ANALYSIS_MODES:
        fail('OpenAPI health AI modes must use the same v2 estimate mode vocabulary')
    if set(schemas['AnalyticsEventName']['enum']) != ANALYTICS_EVENT_NAMES:
        fail('OpenAPI analytics event names differ from the server-only DB enum')
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
    product_3d = schemas['Product3D']
    if product_3d.get('additionalProperties') is not False:
        fail('Product3D must reject fields outside the published contract')
    if set(product_3d.get('required', [])) != PRODUCT_3D_REQUIRED_FIELDS:
        fail('Product3D required fields differ from the canonical product model')
    product_detail = schemas['ProductDetail']
    if {'has3d', 'model3d'} - set(product_detail.get('required', [])):
        fail('ProductDetail must explicitly expose 3D readiness and nullable model data')
    if product_detail['properties']['model3d'].get('oneOf') != [
        {'$ref': '#/components/schemas/Product3D'},
        {'type': 'null'},
    ]:
        fail('ProductDetail.model3d must be Product3D or null when assets are unavailable')
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

    lifecycle_targets = schemas['LifecycleCommandTargetStatus']
    if set(lifecycle_targets.get('enum', [])) != LIFECYCLE_COMMAND_TARGET_STATUSES:
        fail('LifecycleCommandTargetStatus differs from the guarded operator command contract')
    lifecycle_request = schemas['ApplicationLifecycleCommandRequest']
    if lifecycle_request.get('additionalProperties') is not False:
        fail('ApplicationLifecycleCommandRequest must reject unknown fields')
    if set(lifecycle_request.get('required', [])) != {'targetStatus'}:
        fail('ApplicationLifecycleCommandRequest must require only targetStatus by default')
    lifecycle_request_properties = lifecycle_request.get('properties', {})
    if set(lifecycle_request_properties) != {
        'targetStatus',
        'note',
        'trackingNumber',
        'carrierCode',
        'carrierName',
    }:
        fail('ApplicationLifecycleCommandRequest fields differ from the lifecycle RPC contract')
    if lifecycle_request_properties['targetStatus'].get('$ref') != (
        '#/components/schemas/LifecycleCommandTargetStatus'
    ):
        fail('Lifecycle command targetStatus must reference LifecycleCommandTargetStatus')
    shipping_rules = [
        rule
        for rule in lifecycle_request.get('allOf', [])
        if rule.get('if', {}).get('properties', {}).get('targetStatus', {}).get('const')
        == 'SHIPPED'
    ]
    if len(shipping_rules) != 1:
        fail('Lifecycle command must define exactly one SHIPPED conditional rule')
    shipping_rule = shipping_rules[0]
    if set(shipping_rule.get('then', {}).get('required', [])) != {'trackingNumber'}:
        fail('SHIPPED lifecycle command must require trackingNumber')
    forbidden_shipping_fields = {
        frozenset(condition.get('required', []))
        for condition in shipping_rule.get('else', {}).get('not', {}).get('anyOf', [])
    }
    if forbidden_shipping_fields != {
        frozenset({'trackingNumber'}),
        frozenset({'carrierCode'}),
        frozenset({'carrierName'}),
    }:
        fail('Non-SHIPPED lifecycle commands must reject shipment-only fields')
    lifecycle_response = schemas['ApplicationLifecycleCommandResponse']
    if set(lifecycle_response.get('required', [])) != {
        'applicationId',
        'previousStatus',
        'applicationStatus',
        'occurredAt',
        'shipment',
    }:
        fail('ApplicationLifecycleCommandResponse must expose the complete command result')
    shipment_variants = lifecycle_response.get('properties', {}).get('shipment', {}).get('oneOf', [])
    if not (
        {'$ref': '#/components/schemas/MockShipment'} in shipment_variants
        and {'type': 'null'} in shipment_variants
    ):
        fail('Lifecycle command response shipment must be MockShipment or null')
    request_carrier_code = lifecycle_request_properties['carrierCode']
    response_carrier_code = schemas['MockShipment'].get('properties', {}).get('carrierCode', {})
    for keyword in ('minLength', 'maxLength', 'pattern'):
        if response_carrier_code.get(keyword) != request_carrier_code.get(keyword):
            fail(f'MockShipment carrierCode must preserve request {keyword} constraints')
    if 'const' in response_carrier_code:
        fail('MockShipment carrierCode must accept every carrierCode allowed by the command request')

    pickup_schedule = schemas['PickupSchedule']
    if pickup_schedule.get('additionalProperties') is not False:
        fail('PickupSchedule must reject unknown fields')
    if set(pickup_schedule.get('required', [])) != {'requestedDate', 'timeWindow'}:
        fail('PickupSchedule must require requestedDate and timeWindow')
    pickup_properties = pickup_schedule.get('properties', {})
    if pickup_properties.get('requestedDate', {}).get('format') != 'date':
        fail('PickupSchedule.requestedDate must use the OpenAPI date format')
    time_window = pickup_properties.get('timeWindow', {})
    if (
        time_window.get('minLength') != 1
        or time_window.get('maxLength') != 60
        or time_window.get('pattern') != r'\S'
    ):
        fail('PickupSchedule.timeWindow must be nonblank and at most 60 characters')

    consent_fields = set(CANONICAL_CONSENTS)
    consents = schemas['Consents']
    if consents.get('additionalProperties') is not False:
        fail('Consents must reject unknown fields')
    if set(consents.get('required', [])) != consent_fields:
        fail('Consents required fields differ from the canonical customer notices')
    if set(consents.get('properties', {})) != consent_fields:
        fail('Consents must contain only the canonical customer notices')
    if any(
        definition.get('type') != 'boolean' or definition.get('const') is not True
        for definition in consents['properties'].values()
    ):
        fail('All application consents must be boolean true')
    serialized_openapi = json.dumps(openapi, ensure_ascii=False)
    if any(
        stale_key in serialized_openapi
        for stale_key in ('demoTermsAccepted', 'esgEstimateNoticeAccepted')
    ):
        fail('OpenAPI still contains removed application consent keys')

    create_application = schemas['CreateApplicationRequest']
    required_application_fields = {
        'analysisId',
        'productId',
        'selectedOptions',
        'shippingAddress',
        'pickupSchedule',
        'consents',
    }
    if set(create_application.get('required', [])) != required_application_fields:
        fail('CreateApplicationRequest required fields differ from the v2 order contract')
    if create_application['properties']['pickupSchedule'].get('$ref') != '#/components/schemas/PickupSchedule':
        fail('CreateApplicationRequest.pickupSchedule must reference PickupSchedule')
    application_detail = schemas['ApplicationDetail']
    if 'pickupSchedule' not in set(application_detail.get('required', [])):
        fail('ApplicationDetail must return the persisted pickupSchedule')
    if application_detail['properties']['pickupSchedule'].get('$ref') != '#/components/schemas/PickupSchedule':
        fail('ApplicationDetail.pickupSchedule must reference PickupSchedule')

    application_example = (
        openapi['paths']['/applications']['post']['requestBody']['content']
        ['application/json'].get('example', {})
    )
    if application_example.get('pickupSchedule') != CANONICAL_PICKUP_SCHEDULE:
        fail('POST /applications example must use the canonical pickup schedule')
    if application_example.get('consents') != CANONICAL_CONSENTS:
        fail('POST /applications example must use the canonical consent keys')

    shipment_example = (
        openapi['paths']['/applications/{applicationId}/shipment']['get']['responses']
        ['200']['content']['application/json'].get('example', {})
    )
    if shipment_example != CANONICAL_MOCK_SHIPMENT:
        fail('GET shipment example must match the canonical delivered mock shipment')

    lifecycle_path = '/admin/applications/{applicationId}/lifecycle-commands'
    lifecycle_operation = openapi.get('paths', {}).get(lifecycle_path, {}).get('post', {})
    if not lifecycle_operation:
        fail(f'Missing operator lifecycle API: POST {lifecycle_path}')
    if 'Operator' not in lifecycle_operation.get('tags', []):
        fail('Lifecycle command endpoint must be OPERATOR-only')
    if lifecycle_operation.get('x-required-role') != 'OPERATOR':
        fail('Lifecycle command endpoint must declare x-required-role=OPERATOR')
    if lifecycle_operation.get('operationId') != 'advanceApplicationLifecycle':
        fail('Lifecycle command operationId must be advanceApplicationLifecycle')
    if {'$ref': '#/components/parameters/IdempotencyKey'} not in lifecycle_operation.get('parameters', []):
        fail('Lifecycle command endpoint must require Idempotency-Key')
    lifecycle_body_ref = (
        lifecycle_operation.get('requestBody', {}).get('content', {})
        .get('application/json', {}).get('schema', {}).get('$ref')
    )
    if lifecycle_body_ref != '#/components/schemas/ApplicationLifecycleCommandRequest':
        fail('Lifecycle command body must reference ApplicationLifecycleCommandRequest')
    lifecycle_response_ref = (
        lifecycle_operation.get('responses', {}).get('200', {}).get('content', {})
        .get('application/json', {}).get('schema', {}).get('$ref')
    )
    if lifecycle_response_ref != '#/components/schemas/ApplicationLifecycleCommandResponse':
        fail('Lifecycle command response must reference ApplicationLifecycleCommandResponse')
    for status, response_name in {
        '502': 'BadGateway',
        '503': 'ServiceUnavailable',
    }.items():
        if (
            lifecycle_operation.get('responses', {}).get(status, {}).get('$ref')
            != f'#/components/responses/{response_name}'
        ):
            fail(f'Lifecycle command endpoint must expose {status} {response_name}')
    if not {'400', '401', '403', '404', '409'} <= set(lifecycle_operation.get('responses', {})):
        fail('Lifecycle command must define validation, auth, ownership, not-found, and conflict errors')
    lifecycle_description = lifecycle_operation.get('description', '')
    for fragment in (
        '바로 다음 상태',
        'PRODUCTION_UNAVAILABLE은 IN_PRODUCTION 또는 QUALITY_CHECK',
        'CANCELED는 현재 상태가 PRODUCTION_UNAVAILABLE',
        '409',
    ):
        if fragment not in lifecycle_description:
            fail(f'Lifecycle command guard description is missing: {fragment}')

    inspection_request = schemas['SubmitPhysicalInspectionRequest']
    inspection_request_rules = [
        rule
        for rule in inspection_request.get('allOf', [])
        if rule.get('if', {}).get('properties', {}).get('outcome', {}).get('const')
        == 'CHANGE_REQUIRED'
    ]
    if len(inspection_request_rules) != 1:
        fail('Inspection request must define one CHANGE_REQUIRED conditional rule')
    inspection_request_rule = inspection_request_rules[0]
    if 'proposedTerms' not in inspection_request_rule.get('then', {}).get('required', []):
        fail('CHANGE_REQUIRED inspection must require proposedTerms')
    if (
        inspection_request_rule.get('then', {}).get('properties', {})
        .get('proposedTerms', {}).get('$ref')
        != '#/components/schemas/ApplicationTerms'
    ):
        fail('CHANGE_REQUIRED proposedTerms must reference ApplicationTerms')
    if (
        inspection_request_rule.get('else', {}).get('properties', {})
        .get('proposedTerms', {}).get('type')
        != 'null'
    ):
        fail('Non-change inspections must not accept proposedTerms')
    inspection_reason = inspection_request.get('properties', {}).get('reason', {})
    if (
        inspection_reason.get('minLength') != 1
        or inspection_reason.get('maxLength') != 1000
        or inspection_reason.get('pattern') != r'\S'
    ):
        fail('Inspection reason must match the DB nonblank 1..1000 character contract')

    inspection_response = schemas['PhysicalInspectionResponse']
    inspection_response_rules = [
        rule
        for rule in inspection_response.get('allOf', [])
        if rule.get('if', {}).get('properties', {}).get('outcome', {}).get('const')
        == 'CHANGE_REQUIRED'
    ]
    if len(inspection_response_rules) != 1:
        fail('Inspection response must define one CHANGE_REQUIRED conditional rule')
    inspection_response_rule = inspection_response_rules[0]
    if 'changeRequest' not in inspection_response_rule.get('then', {}).get('required', []):
        fail('CHANGE_REQUIRED inspection response must return the created changeRequest')
    if (
        inspection_response_rule.get('then', {}).get('properties', {})
        .get('changeRequest', {}).get('$ref')
        != '#/components/schemas/ApplicationChangeRequest'
    ):
        fail('CHANGE_REQUIRED response changeRequest must use ApplicationChangeRequest')
    inspection_operation = openapi['paths']['/admin/applications/{applicationId}/inspection']['post']
    if inspection_operation.get('x-required-role') != 'OPERATOR':
        fail('Inspection endpoint must declare x-required-role=OPERATOR')
    if '하나의 트랜잭션' not in inspection_operation.get('description', ''):
        fail('Inspection endpoint must require atomic inspection/change/status persistence')
    if '400' not in inspection_operation.get('responses', {}):
        fail('Inspection endpoint must expose request-validation errors')

    required_paths = {
        lifecycle_path: 'post',
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


def validate_mock(mock: dict[str, Any], version: str) -> tuple[int, int, int]:
    if mock.get('meta', {}).get('version') != version:
        fail('Mock version must match OpenAPI v2.0.0')
    if mock.get('meta', {}).get('contractChange') != 'BREAKING':
        fail('Mock metadata must declare the v2 contract as BREAKING')
    if 'manualReviewCases' in mock:
        fail('manualReviewCases was removed in v2')
    serialized_mock = json.dumps(mock, ensure_ascii=False)
    if any(
        stale_key in serialized_mock
        for stale_key in ('demoTermsAccepted', 'esgEstimateNoticeAccepted')
    ):
        fail('Mock still contains removed application consent keys')

    upload = mock.get('uploadContract', {})
    if set(upload.get('contentTypes', [])) != {'image/jpeg', 'image/png'}:
        fail('Mock upload MIME contract differs from OpenAPI')
    if upload.get('maxFileSizeBytes') != 10_485_760:
        fail('Mock upload maximum must be 10485760 bytes')
    if set(upload.get('purposes', [])) != UPLOAD_PURPOSES:
        fail('Mock upload purposes differ from OpenAPI')
    if upload.get('presignFileCount') != {'min': 1, 'max': 4}:
        fail('Mock presign count must be 1..4')
    if upload.get('analysisFileCount') != {'min': 6, 'max': 6}:
        fail('Mock analysis count must be exactly six')
    if upload.get('analysisSlots') != ANALYSIS_CAPTURE_SLOTS:
        fail('Mock analysis slots must preserve the required capture order')

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
    for code, expected_model in CANONICAL_PRODUCT_3D.items():
        if product_by_code[code].get('model3dReady') is not False:
            fail(f'{code} must keep unavailable 3D assets disabled')
        if product_by_code[code].get('model3d') != expected_model:
            fail(f'{code} model3d differs from the canonical Product3D fixture')
        if (
            product_by_code[code].get('optionGroups')
            != CANONICAL_PRODUCT_OPTION_GROUPS[code]
        ):
            fail(f'{code} optionGroups differ from the canonical product rules')
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
        'name': 'MCM 모노그램 백팩',
        'category': 'BACKPACK',
        'images': [
            {'slot': 'FRONT', 'purpose': 'SOURCE_FRONT', 'url': '/assets/mvp-beta/source-backpack-front.webp'},
            {'slot': 'REAR', 'purpose': 'SOURCE_FRONT', 'url': '/assets/mvp-beta/source-backpack-front.webp'},
            {'slot': 'TOP', 'purpose': 'SOURCE_SIDE', 'url': '/assets/mvp-beta/source-backpack-front.webp'},
            {'slot': 'BOTTOM', 'purpose': 'SOURCE_SIDE', 'url': '/assets/mvp-beta/source-backpack-front.webp'},
            {'slot': 'LEFT_SIDE', 'purpose': 'SOURCE_SIDE', 'url': '/assets/mvp-beta/source-backpack-side.webp'},
            {'slot': 'RIGHT_SIDE', 'purpose': 'SOURCE_SIDE', 'url': '/assets/mvp-beta/source-backpack-side.webp'},
        ],
    }:
        fail('Primary source must be the canonical MCM monogram backpack')
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
    if application.get('pickupSchedule') != CANONICAL_PICKUP_SCHEDULE:
        fail('Canonical application pickupSchedule differs from the order request contract')
    if application.get('consents') != CANONICAL_CONSENTS:
        fail('Canonical application consents differ from the order request contract')

    payments = mock.get('mockPayments', [])
    if len(payments) != 1 or payments[0].get('applicationStatusAfterPayment') != 'ORDER_PLACED':
        fail('Successful demo payment must transition to ORDER_PLACED')

    shipments = mock.get('mockShipments', [])
    if shipments != [CANONICAL_MOCK_SHIPMENT]:
        fail('Canonical mockShipments must contain the single delivered demo shipment')

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
    inspection_fixture = physical[0]
    change_fixture = changes[0]
    if inspection_fixture.get('proposedTerms') != change_fixture.get('proposedTerms'):
        fail('CHANGE_REQUIRED inspection proposedTerms must equal the atomically created change request')
    if (
        change_fixture.get('inspectionId') != inspection_fixture.get('id')
        or change_fixture.get('reason') != inspection_fixture.get('reason')
        or change_fixture.get('createdAt') != inspection_fixture.get('inspectedAt')
    ):
        fail('Inspection and change request fixtures must describe one atomic creation event')
    if change_fixture.get('status') != 'APPROVED' or change_fixture.get('applicationId') != primary['orderId']:
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

    return len(products), len(recaptures), len(shipments)


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
            'six-position display order': 'analysis_images_display_order_check check (display_order between 0 and 5)',
            'exactly-six photo DB guard': 'analysis requires exactly 6 uploaded owner photos',
            'front and rear purpose guard': "ai.display_order between 0 and 1 and ma.purpose = 'SOURCE_FRONT'",
            'remaining directional purpose guard': "ai.display_order between 2 and 5 and ma.purpose = 'SOURCE_SIDE'",
            'estimate confidence': 'estimate_confidence_percent integer check',
            'estimated reusable rate': 'estimated_reusable_material_rate integer check',
            'recommendation reusable rate': 'estimated_reusable_material_rate integer not null',
            'completed estimate payload': 'constraint completed_analysis_payload_required',
            'external AI consent evidence': 'create table public.analysis_external_ai_consents',
            'external AI request receipt uniqueness': 'unique (customer_id, request_hash)',
            'external AI receipt hash guard': "check (request_hash ~ '^[0-9a-f]{64}$')",
            'external AI link retention': 'analysis_id uuid references public.analyses(id) on delete restrict',
            'external AI immutable evidence': 'external AI consent evidence is immutable',
            'external AI one-time analysis link': 'external AI consent analysis can be linked exactly once',
            'external AI completed analysis link': "a.status = 'COMPLETED'",
            'external AI all-update trigger': 'analysis_external_ai_consents_enforce_owner\nbefore insert or update',
            'external AI owner read': 'analysis_external_ai_consents_owner_read',
            'external AI admin insert': 'grant select, insert on public.analysis_external_ai_consents to service_role',
            'external AI column-only link': 'grant update (analysis_id) on public.analysis_external_ai_consents to service_role',
            'ESG methodology v2': "methodology_version = 'DEMO_LCA_V2'",
            'physical inspections': 'create table public.physical_inspections',
            'inspection proposed terms persistence': 'proposed_terms jsonb',
            'inspection proposed terms guard': 'constraint physical_inspections_proposed_terms_contract',
            'change requests': 'create table public.application_change_requests',
            'state transition guard': 'create or replace function public.enforce_application_transition()',
            'initial status history trigger': 'after insert or update of persisted_status on public.applications',
            'pickup schedule persistence': 'pickup_schedule jsonb not null',
            'pickup schedule JSON guard': 'constraint applications_pickup_schedule_contract',
            'pickup schedule exact keys': "(pickup_schedule - array['requestedDate', 'timeWindow']) = '{}'::jsonb",
            'pickup time-window maximum': "length(trim(pickup_schedule->>'timeWindow')) <= 60",
            'consent JSON guard': 'constraint applications_consents_contract',
            'canonical consent keys': 'serviceAndPrivacyTermsAccepted',
            'initial terms DB contract': 'constraint applications_initial_terms_contract',
            'final terms DB contract': 'constraint applications_final_terms_contract',
            'one order per analysis': 'constraint applications_analysis_id_unique unique (analysis_id)',
            'production approval guard': 'IN_PRODUCTION requires completed inspection and approved changed terms',
            'payment transition': "set persisted_status = 'ORDER_PLACED'",
            'production unavailable cancellation': "when 'PRODUCTION_UNAVAILABLE' then new.persisted_status = 'CANCELED'",
            'atomic inspection RPC': 'create or replace function public.submit_physical_inspection(',
            'guarded lifecycle RPC': 'create or replace function public.advance_application_lifecycle(',
            'operator-only RPC guard': 'if auth.uid() is null or not public.is_operator() then',
            'same-state lifecycle rejection': 'lifecycle command target must be the next status',
            'production-stage unavailable guard': "current_status not in ('IN_PRODUCTION', 'QUALITY_CHECK')",
            'unavailable cancellation command guard': "current_status <> 'PRODUCTION_UNAVAILABLE'",
            'shipping command payload guard': 'shipping fields are accepted only for SHIPPED',
            'unambiguous shipment conflict target': 'on conflict on constraint mock_shipments_application_id_key do update set',
            'customer decision gate': 'PRODUCTION_READY requires customer approval of changed terms',
            'delivered shipment guard': 'DELIVERED requires an existing SHIPPED shipment',
            'existing shipment response lookup': 'if changed_shipment_id is null then',
            'immutable changed terms': 'customer decision cannot alter proposed terms',
            'customer decision trigger': 'create or replace function public.apply_change_request_decision()',
            'certificate issuance guard': 'create or replace function public.enforce_certificate_issuance_state()',
            'certificate issuance trigger': 'create trigger esg_certificates_enforce_issuance_state',
            'issued certificate inverse guard': 'create trigger applications_protect_issued_certificate_state',
            'private owner path': 'constraint media_assets_owner_path',
            '3D readiness gate': 'model_3d_ready boolean not null default false',
            'analytics direct insert revoked': (
                'revoke insert on public.analytics_events\n'
                'from public, anon, authenticated, service_role'
            ),
            'analytics service RPC': (
                'grant execute on function public.record_analytics_event('
            ),
            'analytics rate-limit index': 'analytics_events_user_received_idx on public.analytics_events(user_id, received_at desc)',
            'storage metadata-first upload': "ma.upload_status = 'PENDING'",
            'storage guarded delete helper': 'create or replace function public.can_delete_pending_source_product(',
            'storage linked-image delete guard': 'where ai.media_asset_id = ma.id',
            'storage guarded delete policy': 'public.can_delete_pending_source_product(bucket_id, name)',
            'pending customer decision policy': "status = 'PENDING'",
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
        'demoTermsAccepted',
        'esgEstimateNoticeAccepted',
        'jsonb_object_length',
        'analysis requires 3 to 4 uploaded owner photos',
        'uploaded_photo_count not between 3 and 4',
        'analysis requires exactly 4 uploaded owner photos',
        'uploaded_photo_count <> 4',
        'display_order between 0 and 3',
        'analysis requires exactly 7 uploaded owner photos',
        'uploaded_photo_count <> 7',
        'display_order between 0 and 6',
    ]
    present = [fragment for fragment in forbidden if fragment in sql]
    if present:
        fail(f'SQL still contains removed v1 contract fragments: {present}')
    if re.search(
        r"and ma\.upload_status = 'UPLOADED';\s*if uploaded_photo_count <> 6",
        sql,
        flags=re.IGNORECASE,
    ):
        fail('SQL analysis trigger still accepts six uploaded assets without purpose mapping')

    validate_runtime_trigger_contract(sql, 'supabase-schema.sql')
    validate_analytics_rpc_contract(sql, 'supabase-schema.sql')
    analytics_constraint = re.search(
        r'constraint\s+analytics_events_event_name_check\s+check\s*'
        r'\(event_name\s+in\s*\((.*?)\)\)',
        sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not analytics_constraint:
        fail('supabase-schema.sql lacks the analytics event-name constraint')
    if set(re.findall(r"'([^']+)'", analytics_constraint.group(1))) != ANALYTICS_EVENT_NAMES:
        fail('SQL analytics event-name constraint differs from OpenAPI')
    for code, model_3d in CANONICAL_PRODUCT_3D.items():
        serialized_model = json.dumps(
            model_3d,
            ensure_ascii=False,
            separators=(',', ':'),
        )
        if f"'{serialized_model}'::jsonb" not in sql:
            fail(f'supabase-schema.sql lacks the canonical {code} model_3d seed')
        serialized_options = json.dumps(
            CANONICAL_PRODUCT_OPTION_GROUPS[code],
            ensure_ascii=False,
            separators=(',', ':'),
        )
        if f"'{serialized_options}'::jsonb" not in sql:
            fail(f'supabase-schema.sql lacks canonical {code} optionGroups')


def validate_backend_v2_runtime_migration(
    up_migration: str,
    rollback: str,
) -> None:
    require_fragments(
        up_migration,
        '202608180004 backend v2 runtime up migration',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'private product backup': (
                'private.mcm_backend_v2_runtime_product_backup_20260818'
            ),
            'private function backup': (
                'private.mcm_backend_v2_runtime_function_backup_20260818'
            ),
            'private policy backup': (
                'private.mcm_backend_v2_runtime_policy_backup_20260818'
            ),
            'previous product JSON': 'previous_model_3d jsonb not null',
            'previous option rules': 'previous_option_groups jsonb not null',
            'previous function definition': 'previous_definition text not null',
            'previous policy expression': 'previous_using_expression text',
            'function definition hash': 'migrated_definition_sha256',
            'catalog preflight': (
                'requires the four canonical product IDs and codes'
            ),
            'payment function backup': (
                "to_regprocedure('public.apply_successful_mock_payment()')"
            ),
            'change function backup': (
                "to_regprocedure('public.apply_change_request_decision()')"
            ),
            'duplicate application preflight': (
                'application analysis uniqueness requires manual review of duplicate orders'
            ),
            'one order per analysis': (
                'add constraint applications_analysis_id_unique unique (analysis_id)'
            ),
            '3D readiness column': (
                'add column model_3d_ready boolean not null default false'
            ),
            'disabled 3D backfill': 'model_3d_ready = false',
            'external AI consent table': (
                'create table public.analysis_external_ai_consents'
            ),
            'external AI link retention': (
                'analysis_id uuid references public.analyses(id) on delete restrict'
            ),
            'external AI owner policy': (
                'analysis_external_ai_consents_owner_read'
            ),
            'external AI immutable evidence': (
                'external AI consent evidence is immutable'
            ),
            'external AI all-update trigger': (
                'analysis_external_ai_consents_enforce_owner\n'
                'before insert or update'
            ),
            'external AI link-only grant': (
                'grant update (analysis_id) on public.analysis_external_ai_consents to service_role'
            ),
            'external AI completed analysis link': "a.status = 'COMPLETED'",
            'application terms checks': 'applications_initial_terms_contract',
            'analytics enum check': 'analytics_events_event_name_check',
            'analytics direct insert revoked': (
                'revoke insert on public.analytics_events\n'
                'from public, anon, authenticated, service_role'
            ),
            'analytics service RPC': (
                'grant execute on function public.record_analytics_event('
            ),
            'analytics rate-limit index': 'analytics_events_user_received_idx',
            'pending customer decision policy': "status = 'PENDING'",
            'metadata-first storage insert': "ma.upload_status = 'PENDING'",
            'linked source delete guard': 'where ai.media_asset_id = ma.id',
            'storage delete helper': 'can_delete_pending_source_product',
            'trigger definition backup': 'previous_prepare_trigger_definition',
            'private ACL': 'from public, anon, authenticated;',
        },
    )
    validate_runtime_trigger_contract(
        up_migration,
        '202608180004 backend v2 runtime up migration',
    )
    validate_analytics_rpc_contract(
        up_migration,
        '202608180004 backend v2 runtime up migration',
    )
    for code, model_3d in CANONICAL_PRODUCT_3D.items():
        serialized_model = json.dumps(
            model_3d,
            ensure_ascii=False,
            separators=(',', ':'),
        )
        if f"'{serialized_model}'::jsonb" not in up_migration:
            fail(f'Runtime migration lacks the canonical {code} model_3d value')
        serialized_options = json.dumps(
            CANONICAL_PRODUCT_OPTION_GROUPS[code],
            ensure_ascii=False,
            separators=(',', ':'),
        )
        if f"'{serialized_options}'::jsonb" not in up_migration:
            fail(f'Runtime migration lacks canonical {code} optionGroups')

    require_fragments(
        rollback,
        '202608180004 backend v2 runtime rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'private product backup': (
                'private.mcm_backend_v2_runtime_product_backup_20260818'
            ),
            'private function backup': (
                'private.mcm_backend_v2_runtime_function_backup_20260818'
            ),
            'private policy backup': (
                'private.mcm_backend_v2_runtime_policy_backup_20260818'
            ),
            'product drift stop': (
                'rollback requires manual handling of product models changed after migration'
            ),
            'function drift stop': (
                'rollback requires manual handling of trigger functions changed after migration'
            ),
            'privilege drift stop': (
                'rollback requires manual handling of trigger privileges changed after migration'
            ),
            'restore product JSON': 'set model_3d = backup.previous_model_3d',
            'restore option rules': 'option_groups = backup.previous_option_groups',
            'restore function definition': 'execute backup.previous_definition',
            'restore trigger definition': 'execute access_backup.previous_prepare_trigger_definition',
            'restore exact policies': "'create policy %I on %s as %s for %s to %s%s%s'",
            'restore public execute': 'backup.previous_public_execute',
            'consent evidence rollback stop': (
                'rollback requires manual archival of external AI consent evidence'
            ),
            'remove consent table': (
                'drop table public.analysis_external_ai_consents'
            ),
            'remove rate-limit index': (
                'drop index public.analytics_events_user_received_idx'
            ),
            'remove analysis uniqueness': (
                'drop constraint applications_analysis_id_unique'
            ),
            'remove 3D readiness': 'drop column model_3d_ready',
            'restore analytics service grant': (
                'previous_analytics_service_insert'
            ),
            'analytics RPC drift stop': (
                'rollback requires manual handling of analytics RPC changed after migration'
            ),
            'analytics RPC privilege drift stop': (
                'rollback requires manual handling of analytics RPC privileges changed after migration'
            ),
            'remove analytics RPC': (
                'drop function public.record_analytics_event('
            ),
            'drop policy backup': (
                'drop table private.mcm_backend_v2_runtime_policy_backup_20260818'
            ),
            'drop function backup': (
                'drop table private.mcm_backend_v2_runtime_function_backup_20260818'
            ),
            'drop product backup': (
                'drop table private.mcm_backend_v2_runtime_product_backup_20260818'
            ),
        },
    )
    if re.search(r'\bcascade\b', rollback, flags=re.IGNORECASE):
        fail('Backend v2 runtime rollback must not use broad CASCADE drops')


def validate_capture_four_view_migrations(up_migration: str, rollback: str) -> None:
    require_fragments(
        up_migration,
        '202608180002 capture four-view up migration',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'analysis photo trigger function': 'create or replace function public.enforce_analysis_photo_contract()',
            'exactly-four guard': 'uploaded_photo_count <> 4',
            'exactly-four error': 'analysis requires exactly 4 uploaded owner photos',
            'no fabricated backfill': 'must receive the missing photo',
        },
    )
    require_fragments(
        rollback,
        '202608180002 capture four-view rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'analysis photo trigger function': 'create or replace function public.enforce_analysis_photo_contract()',
            'restore previous guard': 'uploaded_photo_count not between 3 and 4',
            'restore previous error': 'analysis requires 3 to 4 uploaded owner photos',
        },
    )
    if re.search(r'\bcascade\b', rollback, flags=re.IGNORECASE):
        fail('Capture four-view rollback must not use broad CASCADE drops')


def validate_capture_seven_view_migrations(up_migration: str, rollback: str) -> None:
    require_fragments(
        up_migration,
        '202608180003 capture seven-view up migration',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'display order constraint': 'analysis_images_display_order_check',
            'seven-position display order': 'display_order between 0 and 6',
            'analysis photo trigger function': 'create or replace function public.enforce_analysis_photo_contract()',
            'exactly-seven guard': 'uploaded_photo_count <> 7',
            'exactly-seven error': 'analysis requires exactly 7 uploaded owner photos',
            'no fabricated capture backfill': 'does not fabricate capture assets or direction metadata',
        },
    )
    require_fragments(
        rollback,
        '202608180003 capture seven-view rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'manual row safety stop': 'rollback requires manual handling of analysis images with display_order above 3',
            'restore four-position order': 'display_order between 0 and 3',
            'analysis photo trigger function': 'create or replace function public.enforce_analysis_photo_contract()',
            'restore exact-four guard': 'uploaded_photo_count <> 4',
            'restore exact-four error': 'analysis requires exactly 4 uploaded owner photos',
        },
    )
    if re.search(r'\bcascade\b', rollback, flags=re.IGNORECASE):
        fail('Capture seven-view rollback must not use broad CASCADE drops')


def validate_capture_six_view_migrations(up_migration: str, rollback: str) -> None:
    require_fragments(
        up_migration,
        '202608210008 capture six-view up migration',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'private serial-link backup': 'private.mcm_capture_six_view_backup_20260821',
            'private serial-link backup rls': (
                'alter table private.mcm_capture_six_view_backup_20260821\n'
                '  enable row level security;'
            ),
            'serial-link selection': 'where ai.display_order = 6',
            'serial-link removal': 'delete from public.analysis_images\nwhere display_order = 6',
            'media preservation': 'media_assets row and private Storage object are retained',
            'six-position display order': 'display_order between 0 and 5',
            'analysis photo trigger function': 'create or replace function public.enforce_analysis_photo_contract()',
            'exactly-six guard': 'uploaded_photo_count <> 6',
            'exactly-six error': 'analysis requires exactly 6 uploaded owner photos',
            'front and rear purpose guard': "ai.display_order between 0 and 1 and ma.purpose = 'SOURCE_FRONT'",
            'remaining directional purpose guard': "ai.display_order between 2 and 5 and ma.purpose = 'SOURCE_SIDE'",
        },
    )
    require_fragments(
        rollback,
        '202608210008 capture six-view rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'required private backup': 'capture six-view rollback requires the private serial-photo backup',
            'deleted-reference safety stop': 'rollback requires manual handling of deleted analyses or serial-photo assets',
            'link-conflict safety stop': 'rollback requires manual handling of conflicting serial-photo links',
            'restore seven-position order': 'display_order between 0 and 6',
            'restore serial links': 'insert into public.analysis_images',
            'restore exact-seven guard': 'uploaded_photo_count <> 7',
            'restore exact-seven error': 'analysis requires exactly 7 uploaded owner photos',
            'restore front and rear purposes': "ai.display_order between 0 and 1 and ma.purpose = 'SOURCE_FRONT'",
            'restore remaining directional purposes': "ai.display_order between 2 and 5 and ma.purpose = 'SOURCE_SIDE'",
            'restore serial purpose': "ai.display_order = 6 and ma.purpose = 'ENGRAVING'",
            'remove private backup': 'drop table private.mcm_capture_six_view_backup_20260821',
        },
    )
    if re.search(r'\bcascade\b', up_migration + rollback, flags=re.IGNORECASE):
        fail('Capture six-view migration must not use CASCADE')
    if re.search(
        r"and ma\.upload_status = 'UPLOADED';\s*if uploaded_photo_count <> 6",
        up_migration,
        flags=re.IGNORECASE,
    ):
        fail('Capture six-view migration still accepts assets without directional purposes')
    if re.search(
        r"and ma\.upload_status = 'UPLOADED';\s*if uploaded_photo_count <> 7",
        rollback,
        flags=re.IGNORECASE,
    ):
        fail('Capture six-view rollback still accepts seven assets without legacy purpose mapping')


def validate_lifecycle_migrations(up_migration: str, rollback: str) -> None:
    require_fragments(
        up_migration,
        '202608180001 lifecycle up migration',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'private backup table': 'private.mcm_lifecycle_alignment_backup_20260818',
            'pickup schedule add': 'add column if not exists pickup_schedule jsonb',
            'pickup schedule backfill': "'timeWindow', '14:00-16:00'",
            'canonical consent conversion': 'set consents = \'{"serviceAndPrivacyTermsAccepted":true,"aiEstimateNoticeAccepted":true,"inspectionChangeNoticeAccepted":true}\'::jsonb',
            'manual consent review stop': 'consent backfill requires manual review for non-canonical rows',
            'legacy consent scenario guard': 'legacy consent conversion is limited to PRIMARY_SCENARIO demo rows',
            'legacy consent scenario filter': "and a.demo_progress_profile = 'PRIMARY_SCENARIO';",
            'initial status history backfill': 'MIGRATION_BACKFILL_INITIAL_STATUS',
            'inspection terms add': 'add column if not exists proposed_terms jsonb',
            'inspection terms backfill': 'set proposed_terms = acr.proposed_terms',
            'manual inspection review stop': 'CHANGE_REQUIRED backfill requires an existing change request with proposed terms',
            'deferred constraint validation': 'not valid',
            'constraint validation': 'validate constraint physical_inspections_proposed_terms_contract',
            'atomic inspection RPC': 'create or replace function public.submit_physical_inspection(',
            'guarded lifecycle RPC': 'create or replace function public.advance_application_lifecycle(',
            'operator guard': 'if auth.uid() is null or not public.is_operator() then',
            'same-state lifecycle rejection': 'lifecycle command target must be the next status',
            'historical shipment upsert repaired by 005': 'on conflict (application_id) do update set',
            'existing shipment response lookup': 'if changed_shipment_id is null then',
            'certificate preflight': 'existing certificate violates COMPLETED/no-override issuance rule',
            'certificate trigger': 'create trigger esg_certificates_enforce_issuance_state',
            'inverse certificate trigger': 'create trigger applications_protect_issued_certificate_state',
            'RPC execute grant': 'grant execute on function public.advance_application_lifecycle(',
        },
    )
    require_fragments(
        rollback,
        '202608180001 lifecycle rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'new-row safety stop': 'rollback requires manual handling of applications created after migration',
            'remove initial history backfill': "where note = 'MIGRATION_BACKFILL_INITIAL_STATUS'",
            'drop lifecycle RPC': 'drop function public.advance_application_lifecycle(',
            'drop inspection RPC': 'drop function public.submit_physical_inspection(',
            'drop certificate trigger': 'drop trigger if exists esg_certificates_enforce_issuance_state',
            'drop inverse certificate trigger': 'drop trigger if exists applications_protect_issued_certificate_state',
            'restore backed-up consents': 'set consents = b.consents',
            'drop inspection terms': 'drop column if exists proposed_terms',
            'drop pickup schedule': 'drop column if exists pickup_schedule',
            'remove backup table': 'drop table private.mcm_lifecycle_alignment_backup_20260818',
        },
    )
    if re.search(r'\bcascade\b', rollback, flags=re.IGNORECASE):
        fail('Lifecycle rollback must not use broad CASCADE drops')


def validate_shipment_conflict_hotfix(up_migration: str, rollback: str) -> None:
    require_fragments(
        up_migration,
        '202608190005 shipment conflict hotfix',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'target lifecycle signature': 'public.advance_application_lifecycle(uuid,public.application_status,text,text,text,text)',
            'ambiguous source detection': "position('on conflict (application_id)' in lower(function_definition))",
            'named conflict target': 'on conflict on constraint mock_shipments_application_id_key',
            'unknown shape stop': 'advance_application_lifecycle has an unknown shipment upsert shape',
        },
    )
    require_fragments(
        rollback,
        '202608190005 shipment conflict rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'rollback warning': 'reintroduces the SHIPPED transition defect',
            'restore legacy target': 'on conflict (application_id)',
        },
    )
    if re.search(r'\bcascade\b', up_migration + rollback, flags=re.IGNORECASE):
        fail('Shipment conflict hotfix must not use CASCADE')


def validate_customer_decision_gate_migration(
    up_migration: str,
    rollback: str,
) -> None:
    require_fragments(
        up_migration,
        '202608190006 customer decision gate',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'transition function': "public.enforce_application_transition()",
            'lifecycle function': 'public.advance_application_lifecycle(uuid,public.application_status,text,text,text,text)',
            'approval status check': "acr.status = 'APPROVED'",
            'approval gate error': 'PRODUCTION_READY requires customer approval of changed terms',
            'transition shape guard': 'enforce_application_transition has an unknown v2 shape',
            'lifecycle shape guard': 'advance_application_lifecycle has an unknown v2 shape',
        },
    )
    require_fragments(
        rollback,
        '202608190006 customer decision gate rollback',
        {
            'transaction start': 'begin;',
            'transaction commit': 'commit;',
            'rollback warning': 'reopens the operator bypass',
            'approval gate error': 'PRODUCTION_READY requires customer approval of changed terms',
        },
    )
    if re.search(r'\bcascade\b', up_migration + rollback, flags=re.IGNORECASE):
        fail('Customer decision gate migration must not use CASCADE')


def validate_capture_ui(
    capture_config: str,
    capture_photos: str,
    capture_screen: str,
    serial_capture: str,
    camera_screen: str,
    capture_session: str,
    page_state: str,
    capture_progress: str,
    capture_action: str,
    demo_scenario: str,
) -> None:
    expected_ids = [
        'front',
        'rear',
        'top',
        'bottom',
        'leftSide',
        'rightSide',
        'serialNumber',
    ]
    expected_labels = ['정면', '후면', '상단', '하단', '좌측면', '우측면', '시리얼 번호']
    if re.findall(r'\bid: "([^"]+)"', capture_config) != expected_ids:
        fail('Capture UI slot IDs must preserve the six required views and optional serial slot')
    if re.findall(r'\blabel: "([^"]+)"', capture_config) != expected_labels:
        fail('Capture UI labels must preserve the six required views and optional serial slot')
    require_fragments(
        capture_config,
        'capture-config.ts',
        {
            'front default': 'DEFAULT_CAPTURE_SLOT: CaptureSlotId = "front"',
            'general capture slots': 'GENERAL_CAPTURE_SLOTS = CAPTURE_SLOTS.filter',
            'six directional slots required': 'MIN_REQUIRED_CAPTURES = GENERAL_CAPTURE_SLOTS.length',
            'serial full-width slot': 'className: "captureSlotSerial"',
            'shared serial format': (
                'SERIAL_NUMBER_PATTERN = '
                '/^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z0-9]{11}$/'
            ),
        },
    )
    require_fragments(
        capture_photos,
        'ProductCapturePhotos.tsx',
        {
            'six-photo guidance': '여섯 사진이 필요하며 시리얼 번호 사진은 선택 사항입니다.',
            'required slot grid': 'GENERAL_CAPTURE_SLOTS.map',
            'album slot label': '`앨범에서 ${nextAlbumSlot.label} 사진 선택`',
            'dynamic completion count': '`사진 ${GENERAL_CAPTURE_SLOTS.length}장 등록 완료`',
            'six-photo rule': 'JPG, PNG 6장 · 파일당 최대 10MB',
        },
    )
    require_fragments(
        capture_screen,
        'ProductCaptureScreen.tsx',
        {
            'six required labels': '정면, 후면, 상단, 하단, 좌측면, 우측면',
            'photos and serial required': '사진과 시리얼 번호 입력이 필요해요.',
            'optional serial photo': '시리얼 번호 사진 촬영은 선택 사항이에요.',
        },
    )
    require_fragments(
        serial_capture,
        'SerialNumberCapture.tsx',
        {
            'serial capture label': '시리얼 번호 촬영하여 입력',
            'required serial marker': '<b aria-hidden="true">*</b>',
            'required serial input': 'required',
        },
    )
    if '시리얼 번호 (선택)' in serial_capture:
        fail('SerialNumberCapture.tsx must not label required serial text as optional')
    require_fragments(
        camera_screen,
        'CameraScreen.tsx',
        {
            'slot-safe camera props': 'slot: CaptureSlotId;',
            'completed slot query': 'completedSlots.join(",")',
            'ordered completion round trip': 'const nextCompletedSlots = CAPTURE_SLOTS.filter(',
            'ordered completion IDs': '.map((captureSlot) => captureSlot.id)',
            'six-view camera total': '{GENERAL_CAPTURE_SLOTS.length}',
            'optional serial counter': 'slot === "serialNumber"',
        },
    )
    require_fragments(
        capture_session,
        'CaptureSessionProvider.tsx',
        {
            'slot-keyed capture session': 'Partial<Record<CaptureSlotId, CaptureAsset>>',
            'slot-safe setter': 'setCapture: (slot: CaptureSlotId, blob: Blob, fileName: string)',
            'slot-safe remover': 'removeCapture: (slot: CaptureSlotId)',
        },
    )
    require_fragments(
        page_state,
        'page-state.ts',
        {
            'query slot validation': 'isCaptureSlotId(slot)',
            'query slot de-duplication': 'new Set(',
            'captured slot fallback': 'capturedSlots.push(slot)',
        },
    )
    require_fragments(
        capture_progress,
        'capture-progress.ts',
        {
            'required slot counting': 'return GENERAL_CAPTURE_SLOTS.filter(',
            'session-or-query completion': 'captures[slot.id] || capturedSlotSet.has(slot.id)',
        },
    )
    require_fragments(
        capture_action,
        'ProductCaptureAction.tsx',
        {
            'canonical minimum gate': 'MIN_REQUIRED_CAPTURES - completedCount',
            'zero remaining submit gate': 'remainingCount === 0 && hasRequiredDetails',
            'required serial gate': 'hasValidSerialNumber',
            'required serial copy': '시리얼 번호를 입력해 주세요',
            'six-view upload order': 'const orderedCaptures = GENERAL_CAPTURE_SLOTS.map',
            'six required upload guard': '필수 사진 6장을 모두 등록해 주세요.',
            'analysis submission CTA': 'AI 분석 접수하기',
        },
    )
    require_fragments(
        demo_scenario,
        'demo-scenario.ts',
        {
            'front fallback': 'front: "/assets/mvp-beta/source-backpack-front.webp"',
            'rear fallback': 'rear: "/assets/mvp-beta/source-backpack-front.webp"',
            'top fallback': 'top: "/assets/mvp-beta/source-backpack-front.webp"',
            'bottom fallback': 'bottom: "/assets/mvp-beta/source-backpack-front.webp"',
            'left fallback': 'leftSide: "/assets/mvp-beta/source-backpack-side.webp"',
            'right fallback': 'rightSide: "/assets/mvp-beta/source-backpack-side.webp"',
            'serial fallback': 'serialNumber: "/assets/mvp-beta/source-backpack-engraving.webp"',
        },
    )


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
            'six-image rule': 'six supplied images',
            'six-view order': 'front, rear, top, bottom, left side, and right side views',
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
            'six-image requirement': 'imageUrls.length !== 6',
            'six-image index range': 'imageIndex: z.number().int().min(0).max(5)',
            'ordered six-view request': '정면, 후면, 상단, 하단, 좌측면, 우측면 순서',
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
            'canonical pickup date': "requestedDate: '2026-08-19'",
            'canonical pickup window': "timeWindow: '14:00-16:00'",
            'service and privacy consent': 'serviceAndPrivacyTermsAccepted: true',
            'inspection change consent': 'inspectionChangeNoticeAccepted: true',
            'unavailable-to-canceled transition': "PRODUCTION_UNAVAILABLE: ['CANCELED']",
            'lifecycle command target enum': 'LIFECYCLE_COMMAND_TARGET_STATUSES',
            'lifecycle command request type': 'ApplicationLifecycleCommand',
            'guarded lifecycle command transitions': 'LIFECYCLE_COMMAND_TRANSITIONS',
            'production-stage unavailable command': "IN_PRODUCTION: ['QUALITY_CHECK', 'PRODUCTION_UNAVAILABLE']",
            'canonical delivered shipment': 'PRIMARY_DEMO_SHIPMENT',
            'canonical tracking number': "trackingNumber: 'DEMO-RB-20260817-0001'",
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


def validate_runtime_analysis_contract(
    route: str,
    service: str,
    analysis_contract: str,
    provider: str,
    hybrid_provider: str,
    request_policy: str,
) -> None:
    require_fragments(
        route,
        'POST /api/v2/analyses Route Handler',
        {
            'exactly-six request schema': 'z.array(z.string().uuid()).length(6)',
            'unique image IDs': 'new Set(ids).size === ids.length',
            'required serial regex': '/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{11}$/',
            'serial validation message': (
                'serialNumber must be exactly 11 ASCII alphanumeric characters '
                'and include at least one letter and one digit'
            ),
        },
    )
    require_fragments(
        service,
        'analysisService.ts',
        {
            'exactly-six service guard': 'input.imageAssetIds.length !== 6',
            'six unique image IDs': 'new Set(input.imageAssetIds).size !== 6',
            'six-image upload guard': 'All six image assets must be uploaded before analysis',
            'purpose metadata read': ".select('id,owner_id,bucket,path,upload_status,purpose')",
            'ordered purpose check': 'asset.purpose !== expectedPurpose',
            'purpose mismatch rejection': 'Image asset purpose does not match required capture slot',
            'ordered display persistence': 'display_order: displayOrder',
            'required serial input type': 'serialNumber: string;',
            'serial normalization': 'const serialNumber = input.serialNumber?.trim();',
            'serial service validation': '/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{11}$/.test(serialNumber)',
            'normalized serial persistence': 'serialNumber,',
        },
    )
    purpose_mapping = re.search(
        r'const ANALYSIS_IMAGE_PURPOSES = \[(.*?)\] as const;',
        service,
        flags=re.DOTALL,
    )
    expected_purposes = [
        'SOURCE_FRONT',
        'SOURCE_FRONT',
        'SOURCE_SIDE',
        'SOURCE_SIDE',
        'SOURCE_SIDE',
        'SOURCE_SIDE',
    ]
    if not purpose_mapping or re.findall(r"'([^']+)'", purpose_mapping.group(1)) != expected_purposes:
        fail('analysisService.ts must map positions 0~1 to SOURCE_FRONT and 2~5 to SOURCE_SIDE')
    require_fragments(
        analysis_contract,
        'contracts/analysis.ts',
        {
            'six-image index range': 'imageIndex: z.number().int().min(0).max(5)',
            'runtime image-count bound check': 'imageIndex >= imageCount',
        },
    )
    require_fragments(
        provider,
        'OpenAiVisionProvider.ts',
        {
            'six-image prompt': 'Analyze exactly six supplied images',
            'six-view order': 'front, rear, top, bottom, left side, and right side',
            'six-image requirement': 'input.imageUrls.length !== 6',
            'six-image index range': 'imageIndex from 0 through 5',
            'six-image user message': '각 VIEW 라벨 바로 다음 이미지만 해당 시점의 증거로 사용하고, 여섯 장을 동일 제품으로 분석하세요.',
            'serialized LIVE analysis': 'runSerializedOpenAiAnalysis(deadlineAtMs',
            'reserved final deadline': 'FINAL_ANALYSIS_RESERVED_MS = 65_000',
            'optional lookup deadline': 'calculateOptionalStageDeadline(',
            'lookup policy stage': "stage: 'WIKI_LOOKUP'",
            'final policy stage': "stage: 'FINAL_ANALYSIS'",
            'final output cap': 'max_completion_tokens: FINAL_ANALYSIS_MAX_COMPLETION_TOKENS',
        },
    )
    require_fragments(
        hybrid_provider,
        'HybridVisionProvider.ts',
        {
            'structured failure metadata': 'readProviderFailureMetadata(error)',
            'canonical fallback input': 'canonicalFixtureFallbackInput(input)',
            'stable fallback warning': 'providerFallbackWarning(providerFailure)',
        },
    )
    require_fragments(
        request_policy,
        'openAiRequestPolicy.ts',
        {
            'Retry-After parsing': "headers.get('retry-after')",
            'project-token reset header': "x-ratelimit-reset-project-tokens",
            'exhausted reset delay': 'exhaustedBucketResetDelay(metadata)',
            'quota retry exclusion': "metadata.kind !== 'RATE_LIMIT'",
        },
    )
    if 'providerFailure: providerOutput.providerFailure' in service:
        fail('analysisService.ts must not expose provider rate-limit diagnostics in provider_result')
    for label, text in {
        'analysis Route Handler': route,
        'analysis service': service,
        'analysis contract': analysis_contract,
        'runtime vision provider': provider,
    }.items():
        stale = [
            fragment
            for fragment in (
                'length(7)',
                'length !== 7',
                'size !== 7',
                'exactly seven',
                'All seven image assets',
                'max(6)',
                '0 through 6',
                'serial-number detail',
            )
            if fragment in text
        ]
        if stale:
            fail(f'{label} still contains exact-seven analysis fragments: {stale}')


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
        'demoTermsAccepted',
        'esgEstimateNoticeAccepted',
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
        'pickupSchedule',
        'serviceAndPrivacyTermsAccepted',
        'inspectionChangeNoticeAccepted',
        '2026-08-19',
        '14:00-16:00',
        '/admin/applications/{applicationId}/lifecycle-commands',
        'Idempotency-Key',
        'trackingNumber',
        '하나의 트랜잭션',
        'DEMO-RB-20260817-0001',
        'supabase/migrations/202608180001_lifecycle_integrity.sql',
        'supabase/rollbacks/202608180001_lifecycle_integrity.sql',
        'supabase/migrations/202608180002_capture_four_views.sql',
        'supabase/rollbacks/202608180002_capture_four_views.sql',
        'supabase/migrations/202608180003_capture_seven_views.sql',
        'supabase/rollbacks/202608180003_capture_seven_views.sql',
        'supabase/migrations/202608180004_backend_v2_runtime.sql',
        'supabase/rollbacks/202608180004_backend_v2_runtime.sql',
        'supabase/migrations/202608190005_shipment_conflict_hotfix.sql',
        'supabase/rollbacks/202608190005_shipment_conflict_hotfix.sql',
        'supabase/migrations/202608190006_customer_decision_gate.sql',
        'supabase/rollbacks/202608190006_customer_decision_gate.sql',
        'supabase/migrations/202608210008_capture_six_views.sql',
        'supabase/rollbacks/202608210008_capture_six_views.sql',
        '정면·후면·상단·하단·좌측면·우측면 6개',
        '배열 0~1의 정면·후면은 `SOURCE_FRONT`',
        '배열 2~5의 상단·하단·좌측면·우측면은 `SOURCE_SIDE`',
        '일련번호 사진은 `imageAssetIds`에 포함하지 않습니다.',
        '신규 분석 요청의 일련번호 문자열은 필수 `serialNumber`로 전달하며',
        'DB 컬럼을 `NOT NULL`로 바꾸지 않고',
    ):
        if fragment not in current_guidance:
            fail(f'API guide is missing canonical v2 value: {fragment}')


def validate_runtime_migration_docs(
    supabase_readme: str,
    setup_guide: str,
    api_contract: str,
    repository_structure: str,
) -> None:
    migration_name = '202608180004_backend_v2_runtime.sql'
    hotfix_name = '202608190005_shipment_conflict_hotfix.sql'
    decision_gate_name = '202608190006_customer_decision_gate.sql'
    six_view_name = '202608210008_capture_six_views.sql'
    require_fragments(
        supabase_readme,
        'supabase/README.md',
        {
            'forward runtime migration': f'migrations/{migration_name}',
            'runtime rollback': f'rollbacks/{migration_name}',
            'forward order': '202608180001` → `202608180002`\n→ `202608180003` → `202608180004` → `202608190005` → `202608190006',
            'shipment hotfix': f'migrations/{hotfix_name}',
            'shipment hotfix rollback': f'rollbacks/{hotfix_name}',
            'customer decision gate': f'migrations/{decision_gate_name}',
            'customer decision gate rollback': f'rollbacks/{decision_gate_name}',
            'product model alignment': 'complete Product3D',
            'payment conflict': 'non-`PENDING_PAYMENT`',
            'customer ownership': '`auth.uid()`, application ownership',
            '3D readiness gate': '`model_3d_ready=false`',
            'one application per analysis': 'one application per\n   analysis',
            'server-only analytics': 'service-role-only\n   `record_analytics_event` RPC',
            'atomic analytics limit': 'per-user advisory transaction lock',
            'analytics rate-limit index': '`(user_id, received_at desc)`',
            'metadata-first upload': 'matching owner/PENDING `media_assets`',
            'linked source delete guard': 'no\n   `analysis_images` row references the asset',
            'external AI consent evidence': '`analysis_external_ai_consents`',
            'consent rollback evidence stop': 'must not destroy\naudit evidence',
            'rollback drift stop': 'refuses to overwrite',
        },
    )
    require_fragments(
        setup_guide,
        'SETUP_GUIDE.md',
        {
            'forward runtime migration': f'supabase/migrations/{migration_name}',
            'forward six-view migration': f'supabase/migrations/{six_view_name}',
            'forward order': '001→002→003→004→005→006→007→008',
            'reverse order': '008 → 007 → 006 → 005 → 004 → 003 → 002 → 001',
            'runtime rollback behavior': '004 rollback',
            'shipment hotfix': f'supabase/migrations/{hotfix_name}',
            'customer decision gate': f'supabase/migrations/{decision_gate_name}',
        },
    )
    require_fragments(
        api_contract,
        'docs/API_CONTRACT.md',
        {
            'six required captures': '정면·후면·상단·하단·좌측면·우측면 총 6슬롯',
            'serial photo excluded': '시리얼 번호 사진은 브라우저 자동 입력용 선택 기능',
            'required serial text': '신규 분석 요청의 `serialNumber` 텍스트는 필수',
            'legacy nullable compatibility': 'DB nullable 컬럼은 유지',
            'forward six-view migration': six_view_name,
            'exact-six database guard': '정확히 6장 조건',
            'reverse migration order': '롤백은 008부터 역순',
        },
    )
    require_fragments(
        repository_structure,
        'docs/REPOSITORY_STRUCTURE.md',
        {
            'runtime migration ownership': 'v2 런타임은 004',
            'shipment/customer/copy ownership': '배송·고객 승인·카피 보정은 005→007',
            'six-view migration ownership': six_view_name,
        },
    )


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
    lifecycle_migration = (
        ROOT / 'supabase' / 'migrations' / '202608180001_lifecycle_integrity.sql'
    ).read_text(encoding='utf-8')
    lifecycle_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608180001_lifecycle_integrity.sql'
    ).read_text(encoding='utf-8')
    capture_migration = (
        ROOT / 'supabase' / 'migrations' / '202608180002_capture_four_views.sql'
    ).read_text(encoding='utf-8')
    capture_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608180002_capture_four_views.sql'
    ).read_text(encoding='utf-8')
    seven_view_migration = (
        ROOT / 'supabase' / 'migrations' / '202608180003_capture_seven_views.sql'
    ).read_text(encoding='utf-8')
    seven_view_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608180003_capture_seven_views.sql'
    ).read_text(encoding='utf-8')
    runtime_migration = (
        ROOT / 'supabase' / 'migrations' / '202608180004_backend_v2_runtime.sql'
    ).read_text(encoding='utf-8')
    runtime_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608180004_backend_v2_runtime.sql'
    ).read_text(encoding='utf-8')
    shipment_hotfix = (
        ROOT / 'supabase' / 'migrations' / '202608190005_shipment_conflict_hotfix.sql'
    ).read_text(encoding='utf-8')
    shipment_hotfix_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608190005_shipment_conflict_hotfix.sql'
    ).read_text(encoding='utf-8')
    decision_gate_migration = (
        ROOT / 'supabase' / 'migrations' / '202608190006_customer_decision_gate.sql'
    ).read_text(encoding='utf-8')
    decision_gate_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608190006_customer_decision_gate.sql'
    ).read_text(encoding='utf-8')
    six_view_migration = (
        ROOT / 'supabase' / 'migrations' / '202608210008_capture_six_views.sql'
    ).read_text(encoding='utf-8')
    six_view_rollback = (
        ROOT / 'supabase' / 'rollbacks' / '202608210008_capture_six_views.sql'
    ).read_text(encoding='utf-8')
    guide = (ROOT / 'MCM_REBORN_API_GUIDE.md').read_text(encoding='utf-8')
    supabase_readme = (ROOT / 'supabase' / 'README.md').read_text(encoding='utf-8')
    setup_guide = (ROOT / 'SETUP_GUIDE.md').read_text(encoding='utf-8')
    api_contract = (ROOT / 'docs' / 'API_CONTRACT.md').read_text(encoding='utf-8')
    repository_structure = (
        ROOT / 'docs' / 'REPOSITORY_STRUCTURE.md'
    ).read_text(encoding='utf-8')
    prompt = (ROOT / 'prompts' / 'bag-analysis.system.txt').read_text(encoding='utf-8')
    provider = (ROOT / 'examples' / 'openai-analysis.ts').read_text(encoding='utf-8')
    runtime_analysis_route = (
        ROOT / 'mcm-reborn' / 'app' / 'api' / 'v2' / 'analyses' / 'route.ts'
    ).read_text(encoding='utf-8')
    runtime_analysis_service = (
        ROOT / 'mcm-reborn' / 'server' / 'analyses' / 'analysisService.ts'
    ).read_text(encoding='utf-8')
    runtime_analysis_contract = (
        ROOT / 'mcm-reborn' / 'contracts' / 'analysis.ts'
    ).read_text(encoding='utf-8')
    runtime_vision_provider = (
        ROOT / 'mcm-reborn' / 'server' / 'openai' / 'OpenAiVisionProvider.ts'
    ).read_text(encoding='utf-8')
    runtime_hybrid_provider = (
        ROOT / 'mcm-reborn' / 'server' / 'openai' / 'HybridVisionProvider.ts'
    ).read_text(encoding='utf-8')
    runtime_request_policy = (
        ROOT / 'mcm-reborn' / 'server' / 'openai' / 'openAiRequestPolicy.ts'
    ).read_text(encoding='utf-8')
    recommendation = (ROOT / 'examples' / 'recommendation.ts').read_text(encoding='utf-8')
    mock_status = (ROOT / 'examples' / 'mock-status.ts').read_text(encoding='utf-8')
    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    env_example = (ROOT / '.env.example').read_text(encoding='utf-8')
    capture_config = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'capture-config.ts'
    ).read_text(encoding='utf-8')
    capture_photos = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'ProductCapturePhotos.tsx'
    ).read_text(encoding='utf-8')
    capture_screen = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'ProductCaptureScreen.tsx'
    ).read_text(encoding='utf-8')
    serial_capture = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'SerialNumberCapture.tsx'
    ).read_text(encoding='utf-8')
    camera_screen = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'CameraScreen.tsx'
    ).read_text(encoding='utf-8')
    capture_session = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'CaptureSessionProvider.tsx'
    ).read_text(encoding='utf-8')
    page_state = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'page-state.ts'
    ).read_text(encoding='utf-8')
    capture_progress = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'capture-progress.ts'
    ).read_text(encoding='utf-8')
    capture_action = (
        ROOT / 'mcm-reborn' / 'components' / 'screens' / 'entry-capture'
        / 'ProductCaptureAction.tsx'
    ).read_text(encoding='utf-8')
    demo_scenario = (
        ROOT / 'mcm-reborn' / 'data' / 'demo-scenario.ts'
    ).read_text(encoding='utf-8')

    operation_count, schema_count = validate_openapi(openapi)
    product_count, recapture_count, shipment_count = validate_mock(
        mock,
        openapi['info']['version'],
    )
    validate_sql(sql)
    validate_lifecycle_migrations(lifecycle_migration, lifecycle_rollback)
    validate_capture_four_view_migrations(capture_migration, capture_rollback)
    validate_capture_seven_view_migrations(
        seven_view_migration,
        seven_view_rollback,
    )
    validate_capture_six_view_migrations(
        six_view_migration,
        six_view_rollback,
    )
    validate_backend_v2_runtime_migration(
        runtime_migration,
        runtime_rollback,
    )
    validate_shipment_conflict_hotfix(
        shipment_hotfix,
        shipment_hotfix_rollback,
    )
    validate_customer_decision_gate_migration(
        decision_gate_migration,
        decision_gate_rollback,
    )
    validate_capture_ui(
        capture_config,
        capture_photos,
        capture_screen,
        serial_capture,
        camera_screen,
        capture_session,
        page_state,
        capture_progress,
        capture_action,
        demo_scenario,
    )
    validate_prompt_and_examples(prompt, provider, recommendation, mock_status)
    validate_runtime_analysis_contract(
        runtime_analysis_route,
        runtime_analysis_service,
        runtime_analysis_contract,
        runtime_vision_provider,
        runtime_hybrid_provider,
        runtime_request_policy,
    )
    validate_guide(guide)
    validate_runtime_migration_docs(
        supabase_readme,
        setup_guide,
        api_contract,
        repository_structure,
    )
    validate_readme_and_env(readme, env_example)

    print(
        'OK: v2.0.0 breaking contract;',
        f'{len(openapi["paths"])} paths,',
        f'{operation_count} operations,',
        f'{schema_count} schemas,',
        f'{product_count} products,',
        f'{recapture_count} recapture fixture,',
        f'{shipment_count} canonical shipment,',
        'versioned lifecycle, capture, and backend-runtime migrations with rollbacks,',
        'one canonical order RB-20260817-0001.',
    )


if __name__ == '__main__':
    main()
