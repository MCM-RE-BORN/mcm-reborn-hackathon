# MCM RE:BORN API 구현 가이드

> 계약 버전: **2.0.0 (BREAKING)**
>
> 기준일: 2026-08-21
>
> 목적: 서비스 시연·데모 MVP의 프론트엔드, Route Handler, Mock, Supabase 구현 기준
>
> 구현 상태: `openapi.yaml`의 25개 API operation을 구현하는 `mcm-reborn/app/api/v2/` Route Handler 파일 23개와 서비스·DB 계약이 있습니다. 고객·운영 콘솔 화면은 아직 중앙 Fixture를 사용하며 API에 연결되지 않았고, 실제 Supabase 프로젝트·migration·OpenAI LIVE 호출도 검증되지 않았습니다. 상세 판정은 [`docs/BACKEND_V2_DESIGN.md`](docs/BACKEND_V2_DESIGN.md)를 따릅니다.

기계 판독 기준은 `openapi.yaml`입니다. 이 문서는 구현 의도와 대표 시나리오를 설명하며, 값이 다르면 OpenAPI를 우선합니다. 데모 고정값은 `mock-data.json`, DB 타입과 무결성 규칙은 `supabase-schema.sql`을 함께 확인합니다.

## 1. v2 핵심 원칙

1. 이 MVP는 최소 기능 검증보다 **최종 서비스 흐름을 자연스럽게 시연**하는 것이 우선입니다.
2. 현재 모델이 안정적으로 판단하기 어려운 값은 고정 Fixture 또는 입력 기반 시드 예상값으로 제공합니다.
3. 재활용률, 재활용 면적, 추천, 가격, 기간, ESG 값 등 AI·데모 산출값은 반드시 `estimateMeta`와 예상치 안내를 함께 노출합니다.
4. 사진 단계의 `authenticityPrecheck`는 주문 가능성 사전 신호입니다. 공식 정품 판정, 감정서 또는 보증이 아닙니다.
5. 전문가는 주문·결제·수거 후 실물을 검수합니다. 조건이 바뀌면 고객의 명시적 승인 전에는 제작을 시작할 수 없습니다.
6. 한 시연은 하나의 대표 주문 식별자와 상태 이력을 사용합니다. UI의 `orderId`는 API의 `applicationId`와 동일한 UUID를 가리킵니다.

## 2. 공통 규약

- Base URL: `/api/v2`
- 인증: Supabase access token을 `Authorization: Bearer <token>`으로 전달합니다.
- 분석·신청 생성, Mock 결제, lifecycle, 실물 검수와 변경 결정처럼 OpenAPI가 지정한 상태 변경에는 `Idempotency-Key`를 전달합니다. Presign·demo-login·이벤트에는 요구하지 않습니다.
- 통화: `KRW`
- 시간: ISO 8601 UTC 저장, UI에서 Asia/Seoul로 표시
- 오류 형식: `{ "error": { "code", "message", "requestId", "details" } }`
- 외부 Provider 키와 service-role 키는 서버에서만 사용합니다.
- `POST /events`도 Bearer 인증이 필수이며 익명 이벤트를 허용하지 않습니다.

## 3. 사진 업로드와 분석 생성

### 3.1 업로드 계약

| 항목 | v2 기준 |
|---|---|
| MIME | `image/jpeg`, `image/png` |
| 파일당 최대 크기 | `10485760` bytes (10 MiB) |
| 용도 | `SOURCE_FRONT`, `SOURCE_SIDE`, `INTERIOR`, `ENGRAVING` |
| Presign 1회 요청 | 1~4개 |
| 분석 생성에 연결할 사진 | 정면·후면·상단·하단·좌측면·우측면 6개 |

`POST /uploads/presign`은 점진 업로드를 위해 한 번에 1~4개 사진을 요청할 수 있습니다. 최종 `POST /analyses`에서는 업로드가 완료된 서로 다른 자산 6개를 정면·후면·상단·하단·좌측면·우측면 순서로 전달해야 합니다. 배열 0~1의 정면·후면은 `SOURCE_FRONT`, 배열 2~5의 상단·하단·좌측면·우측면은 `SOURCE_SIDE` purpose여야 하며, `INTERIOR`·`ENGRAVING` 자산은 분석 입력으로 거부합니다. 선택 촬영한 일련번호 사진은 `imageAssetIds`에 포함하지 않습니다. 신규 분석 요청의 일련번호 문자열은 필수 `serialNumber`로 전달하며, trim 후 ASCII 영문자와 숫자를 각각 하나 이상 포함하는 정확히 11자리여야 합니다. 촬영 방향은 프런트 세션과 배열 순서로 관리하며 기존 Storage `purpose` enum을 방향별로 확장하지 않습니다. Route Handler는 자산 소유자, 업로드 완료 여부, 배열 위치별 purpose와 일련번호 형식을 다시 검증합니다.

`mock-data.json.primaryScenario.source.images`의 WebP 경로는 앱에 번들된 표시용 Fixture입니다. 고객이 Presign으로 올리는 소스 파일의 허용 MIME에는 WebP가 포함되지 않습니다.

```json
{
  "files": [
    {
      "fileName": "left-side.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 5242880,
      "purpose": "SOURCE_SIDE"
    }
  ]
}
```

### 3.2 분석 생성 요청

`POST /analyses`의 제품 정보는 분석의 재현성과 시연 문맥을 위해 필수입니다.

```json
{
  "imageAssetIds": [
    "90000000-0000-4000-8000-000000000001",
    "90000000-0000-4000-8000-000000000002",
    "90000000-0000-4000-8000-000000000003",
    "90000000-0000-4000-8000-000000000004",
    "90000000-0000-4000-8000-000000000005",
    "90000000-0000-4000-8000-000000000006"
  ],
  "category": "BACKPACK",
  "purchaseYear": 2019,
  "useDuration": "5년 이상",
  "desiredUse": "여권지갑",
  "serialNumber": "MK123456789",
  "conditionNote": "하단 모서리에 가벼운 마모가 있어요.",
  "locale": "ko-KR",
  "demoScenarioKey": "MCM_BACKPACK_CHANGE_APPROVED_20260817"
}
```

필수: `category`, `purchaseYear`, `useDuration`, `desiredUse`, `serialNumber`

선택: `conditionNote`

`serialNumber`는 앞뒤 공백 제거 후 ASCII 영문자와 숫자를 각각 하나 이상 포함하는 정확히 11자리여야 합니다. 기존 분석 행의 nullable 시리얼 값을 읽는 호환성은 유지하므로 DB 컬럼을 `NOT NULL`로 바꾸지 않고 신규 `POST /analyses` 쓰기 경계에서만 필수 조건을 적용합니다.

분석 상태는 아래 다섯 값만 사용합니다.

```text
RECEIVED | ANALYZING | SUPPLEMENT_REQUIRED | COMPLETED | FAILED
```

### 3.3 예상값 메타데이터

완료된 분석 응답은 `estimateMeta`를 필수로 포함합니다.

```json
{
  "estimateMeta": {
    "mode": "DEMO_FIXTURE",
    "confidencePercent": 87,
    "notice": "사진과 데모 데이터를 기반으로 한 예상치이며 주문 후 전문가 실물 검수에서 변경될 수 있습니다."
  },
  "estimatedReusableMaterialRate": 72,
  "estimatedReusableAreaCm2": 3024
}
```

`estimateMeta.mode`:

- `DEMO_FIXTURE`: 발표용으로 검증한 대표 고정 데이터
- `SEEDED_ESTIMATE`: 입력을 시드로 재현 가능하게 생성한 예상 데이터
- `LIVE`: 실제 AI Provider 응답

어떤 모드를 사용하더라도 UI는 `confidencePercent`와 `notice`를 숨기지 않습니다. 재활용률 필드명은 항상 `estimatedReusableMaterialRate`입니다.

`LIVE`는 공식 OpenAI JavaScript SDK의 `chat.completions.parse`와 Zod `zodResponseFormat`을 사용하는 Chat Completions Structured Outputs 구현입니다. 두 단계 호출은 하나의 deadline과 프로세스 단위 FIFO를 사용하며, lookup의 rate limit·quota 뒤에는 최종 호출을 추가하지 않습니다. 최종 호출의 일시적 429만 `Retry-After`와 jitter 뒤 한 번 재시도하고 quota·billing 한도는 재시도하지 않습니다. 제공자 최종 장애에는 canonical `DEMO_FIXTURE`로 폴백해 작은 `API오류로 인한 DEMO` 표기와 private 진단을 남기지만, 이미지 품질 실패는 성공으로 바꾸지 않습니다.

private 이미지를 외부 AI에 보내려면 배포의 `ENABLE_EXTERNAL_AI=true`, 고정된 `EXTERNAL_AI_PRIVACY_NOTICE_VERSION`, OpenAI 서버 설정과 아래 요청 필드를 모두 만족해야 합니다.

```json
{
  "externalAiProcessingConsentAccepted": true,
  "externalAiPrivacyNoticeVersion": "<현재 배포의 notice version>"
}
```

서버는 외부 전송 전에 동의 증적을 기록하고 완료 후 같은 고객의 `COMPLETED` `analysisId`를 한 번만 연결합니다. FK는 `ON DELETE RESTRICT`이므로 연결된 분석 삭제가 증적을 함께 지우지 않습니다. 브라우저 기본 데모는 `DEMO_FIXTURE`이므로 이 동의나 외부 전송이 필요하지 않습니다. 실제 LIVE 호출과 원격 DB 증적은 staging 검증 전까지 연결 완료로 표현하지 않습니다.

### 3.4 사진 기반 주문 가능성 사전 신호

```json
{
  "authenticityPrecheck": {
    "status": "ORDER_ELIGIBLE",
    "estimatePercent": 91,
    "notice": "사진 기반 주문 가능성 사전 신호이며 공식 정품 판정 또는 보증이 아닙니다."
  }
}
```

- `ORDER_ELIGIBLE`: 데모 주문 흐름을 계속할 수 있습니다.
- `INELIGIBLE`: 현재 사진·정보 기준으로 주문 생성을 허용하지 않습니다. 사진 보완 안내 또는 고객 지원 경로를 제시합니다.

이 결과를 공식 감정 결과로 표시하거나 사진 단계에 전문가 승인 절차를 추가하지 않습니다.

## 4. 대표 제품 카탈로그

v2 데모 제품은 아래 네 가지입니다.

| code | 표시명 | category |
|---|---|---|
| `REBORN_PASSPORT_WALLET` | RE:BORN 여권지갑 | `PASSPORT_WALLET` |
| `REBORN_CARD_WALLET` | RE:BORN 카드지갑 | `CARD_WALLET` |
| `REBORN_NAME_TAG` | RE:BORN 캐리어 네임택 | `NAME_TAG` |
| `REBORN_KEYRING` | RE:BORN 키링 | `KEYRING` |

대표 선택은 여권지갑이며 최초 예상 가격은 180,000원, 최초 예상 기간은 3~4주입니다.

DB는 네 제품의 canonical Product3D JSON을 보존하지만 실제 GLB/poster 자산이 준비되지 않은 현재 seed는 `model_3d_ready=false`입니다. 제품 API는 이 경우 `has3d=false`, `model3d=null`로 반환하고 브라우저는 정적 다각도 목업을 사용합니다. 실제 자산을 배치·검증하기 전 readiness만 임의로 켜지 않습니다.

## 5. 주문과 결제

`POST /applications`는 기술적으로 주문을 생성합니다. 반환되는 `applicationId`가 전 구간에서 사용하는 단일 `orderId`입니다. `applicationNumber`는 사람이 읽는 주문 번호입니다.

주문 생성 시 분석이 `COMPLETED`, 이미지 품질이 `ACCEPTABLE`, `authenticityPrecheck.status`가 `ORDER_ELIGIBLE`인지 확인합니다. 생성 직후 상태는 `PENDING_PAYMENT`입니다.

`selectedOptions`는 선택 제품의 `optionGroups`에 정의된 key만 허용하고 SELECT 값·필수 여부·TEXT 최대 길이를 검증합니다. 여권지갑 canonical 선택은 `edgeColor=COGNAC`, 선택 이니셜은 최대 3자입니다. `applications.analysis_id`는 unique이므로 같은 분석으로 신청을 두 개 만들 수 없습니다.

계약상 주문 생성 요청은 수거 희망 일정과 세 가지 필수 동의를 함께 전달하며, 서버 구현은 이를 주문에 저장해야 합니다. 동의는 모두 `true`여야 하며 임의의 예전 키나 추가 키를 받지 않습니다.

```json
{
  "analysisId": "20000000-0000-4000-8000-000000000001",
  "productId": "10000000-0000-4000-8000-000000000001",
  "selectedOptions": { "edgeColor": "COGNAC", "initials": "MCM" },
  "shippingAddress": {
    "recipientName": "김민지",
    "phone": "010-1234-5678",
    "postalCode": "04524",
    "address1": "서울시 중구 퇴계로 24",
    "address2": "101동 1203호"
  },
  "pickupSchedule": {
    "requestedDate": "2026-08-19",
    "timeWindow": "14:00-16:00"
  },
  "consents": {
    "serviceAndPrivacyTermsAccepted": true,
    "aiEstimateNoticeAccepted": true,
    "inspectionChangeNoticeAccepted": true
  }
}
```

계약의 `ApplicationDetail`은 저장된 `pickupSchedule`을 동일한 형태로 반환합니다. 서버 구현은 동의 원문을 저장하되 고객 응답에 다시 노출하지 않아야 합니다.

`POST /applications/{applicationId}/mock-payment`가 성공하면 상태는 반드시 `ORDER_PLACED`가 됩니다. 결제 실패 시 `PENDING_PAYMENT`를 유지합니다.

## 6. 주문 상태 머신

정상 경로:

```text
PENDING_PAYMENT
→ ORDER_PLACED
→ PICKUP_SCHEDULED
→ PICKUP_IN_PROGRESS
→ PRODUCT_RECEIVED
→ EXPERT_INSPECTION
→ PRODUCTION_READY
→ IN_PRODUCTION
→ QUALITY_CHECK
→ SHIPPED
→ DELIVERED
→ COMPLETED
```

실물 검수 결과 조건이 바뀌는 경로:

```text
EXPERT_INSPECTION
→ CHANGE_APPROVAL_REQUIRED
→ 고객 approve: PRODUCTION_READY
→ 고객 reject: CANCELED
```

`PRODUCTION_UNAVAILABLE`은 제작 불가 판정을 표시하는 예외 상태입니다. 고객 안내와 Mock 결제 취소·환불 처리 후 `CANCELED`로 전환하며, `CANCELED`에서 여정이 종료됩니다.

### 운영자 상태 진행 명령

수거·제작·품질·배송의 실제 서버 연동은 운영자 전용 `POST /admin/applications/{applicationId}/lifecycle-commands` 한 곳에서 진행합니다. 모든 요청은 `Idempotency-Key`가 필요하며, 현재 상태에서 허용된 바로 다음 상태로만 이동합니다.

```json
{
  "targetStatus": "SHIPPED",
  "note": "최종 품질 검수를 통과해 배송을 시작합니다.",
  "trackingNumber": "DEMO-RB-20260817-0001",
  "carrierCode": "MCM_REBORN_DEMO",
  "carrierName": "MCM RE:BORN Demo Logistics"
}
```

명령 target은 아래 값만 사용합니다.

```text
PICKUP_SCHEDULED | PICKUP_IN_PROGRESS | PRODUCT_RECEIVED | EXPERT_INSPECTION
IN_PRODUCTION | QUALITY_CHECK | SHIPPED | DELIVERED | COMPLETED
PRODUCTION_UNAVAILABLE | CANCELED
```

- `SHIPPED`에는 `trackingNumber`가 필수이며 `carrierCode`, `carrierName`은 생략 시 데모 물류 기본값을 사용합니다. 다른 target에는 이 배송 필드를 보내지 않습니다.
- `PRODUCTION_READY`와 `CHANGE_APPROVAL_REQUIRED`는 이 명령으로 만들지 않습니다. 실물 검수와 고객 변경안 결정 API만 해당 상태를 만들 수 있습니다.
- `PRODUCTION_UNAVAILABLE` target은 `IN_PRODUCTION` 또는 `QUALITY_CHECK`에서 공정 중 제작 불가를 발견했을 때만 허용합니다. `EXPERT_INSPECTION`의 제작 불가는 검수 outcome으로 기록합니다.
- `CANCELED` target은 현재 상태가 `PRODUCTION_UNAVAILABLE`일 때만 허용합니다.
- 건너뛰기, 역행, guard 미충족은 `409 Conflict`이며 상태 이력을 남기지 않습니다. 같은 멱등 키와 같은 정규화 요청의 재시도는 최초 결과를 반환하고, 같은 키를 다른 payload에 재사용하면 `409`입니다.

Supabase RPC `advance_application_lifecycle`는 변경된 상태와 `shipment_id`를 반환합니다. 구현된 Route Handler는 이 ID로 Mock 배송 행을 읽어 HTTP `ApplicationLifecycleCommandResponse.shipment`에 객체 또는 `null`을 채웁니다.

### 제작 시작 무결성 규칙

`IN_PRODUCTION` 전환은 아래 둘 중 하나를 만족해야 합니다.

1. 실물 검수 결과가 `NO_CHANGE`이고 주문 상태가 `PRODUCTION_READY`입니다.
2. 실물 검수 결과가 `CHANGE_REQUIRED`이며 연결된 변경안이 `APPROVED`이고 주문 상태가 `PRODUCTION_READY`입니다.

구현된 API 서비스와 `supabase-schema.sql`의 DB trigger가 모두 이 규칙을 검사합니다. UI에서 버튼을 숨기는 것만으로는 충분하지 않으며, 실제 staging에서도 우회 쓰기가 거부되는지 확인해야 합니다.

## 7. 주문 후 전문가 실물 검수

### 7.1 검수 결과 제출

`POST /admin/applications/{applicationId}/inspection`

```json
{
  "outcome": "CHANGE_REQUIRED",
  "confirmedReusableMaterialRate": 68,
  "confirmedReusableAreaCm2": 2860,
  "reason": "사진에서 보이지 않던 내부 원단 손상이 확인되어 재단 범위를 조정했어요.",
  "proposedTerms": {
    "productId": "10000000-0000-4000-8000-000000000001",
    "amount": { "amount": 195000, "currency": "KRW" },
    "estimatedDuration": "4~5주",
    "estimatedReusableMaterialRate": 68
  }
}
```

검수 결과:

- `NO_CHANGE` → `PRODUCTION_READY`
- `CHANGE_REQUIRED` → 변경안 생성 + `CHANGE_APPROVAL_REQUIRED`
- `PRODUCTION_UNAVAILABLE` → `PRODUCTION_UNAVAILABLE` 기록 → 제작 불가 안내·Mock 결제 취소 후 `CANCELED`

`CHANGE_REQUIRED` 요청에는 `proposedTerms`가 필수입니다. 서버는 실물 검수 행, 연결된 `PENDING` 변경안, 주문 상태와 상태 이력을 **하나의 트랜잭션**에서 생성해야 합니다. 하나라도 실패하면 모두 롤백하며 검수만 남거나 변경안 없는 `CHANGE_APPROVAL_REQUIRED` 상태를 만들지 않습니다. 성공 응답의 `changeRequest`는 이 트랜잭션에서 생성된 변경안을 반환하고, 다른 outcome에서는 생략하거나 `null`로 반환합니다.

Supabase RPC `submit_physical_inspection`은 같은 트랜잭션에서 만든 `change_request_id`를 반환합니다. Route Handler는 `CHANGE_REQUIRED`일 때 해당 변경안을 읽어 `PhysicalInspectionResponse.changeRequest`에 포함합니다.

### 7.2 변경안 조회와 고객 결정

| API | 의미 | 결과 상태 |
|---|---|---|
| `GET /applications/{applicationId}/change-request` | 변경 전후 가격·기간·제품·재활용률과 사유 조회 | 변경 없음 |
| `POST /applications/{applicationId}/change-request/approve` | 고객 승인 | `PRODUCTION_READY` |
| `POST /applications/{applicationId}/change-request/reject` | 고객 거절 | `CANCELED` |

승인·거절은 한 번만 처리하며 `Idempotency-Key`가 필요합니다. 변경안 승인 시 `final_terms`를 제안 조건으로 확정합니다. 거절은 제작 시작이 아니라 주문 취소입니다.

## 8. 대표 데모 시나리오

`mock-data.json.primaryScenario`가 발표의 단일 기준입니다.

| 단계 | 대표 값 |
|---|---|
| 주문번호 | `RB-20260817-0001` |
| 시나리오 키 | `MCM_BACKPACK_CHANGE_APPROVED_20260817` |
| 접수번호 | `SUB-RB-20260817-0001` |
| 원본 | MCM 모노그램 백팩, 2019년, 5년 이상 |
| AI 예상 재활용률 | 72% |
| 예상 신뢰도 | 87% |
| 주문 가능성 사전 신호 | 91%, `ORDER_ELIGIBLE` |
| 최초 선택 | RE:BORN 여권지갑, 180,000원, 3~4주 |
| 수거 희망 일정 | 2026-08-19, `14:00-16:00` |
| 실물 검수 변경 | 68%, 195,000원, 4~5주 |
| 고객 결정 | `APPROVED` |
| Mock 배송 | `DEMO-RB-20260817-0001`, `DELIVERED` |
| 최종 보증서 | `ESG-RB-20260817-0001` |
| 최종 재활용 정보 | 68%, 2,860 cm², 3.43 kgCO₂e 예상 절감 |
| ESG 방법론 | `DEMO_LCA_V2` |

`LOW_QUALITY_RECAPTURE`, `INELIGIBLE_PRECHECK`는 예외 흐름을 보여줄 때만 사용합니다. 예외 Fixture가 대표 주문의 `applicationId` 또는 주문번호를 재사용해서는 안 됩니다.

## 9. 엔드포인트 요약

아래 25개 API operation은 23개 Route Handler 파일로 구현되어 있습니다. 실제 URL에는 모두 `/api/v2` 접두사가 붙습니다.

| 영역 | Method / Path |
|---|---|
| 시스템·인증 | `GET /health`, `POST /auth/demo-login`, `GET /me` |
| 업로드 | `POST /uploads/presign` |
| 분석 | `POST /analyses`, `GET /analyses`, `GET /analyses/{analysisId}` |
| 제품 | `GET /products`, `GET /products/{productId}` |
| 신청 | `POST /applications`, `GET /applications`, `GET /applications/{applicationId}` |
| 주문 조회 | `GET /applications/{applicationId}/timeline`, `GET /applications/{applicationId}/shipment` |
| 결제·보증서 | `POST /applications/{applicationId}/mock-payment`, `GET /applications/{applicationId}/certificate`, `GET /certificates/{certificateId}/verify` |
| 운영자 | `GET /admin/applications`, `GET /admin/applications/{applicationId}`, `POST /admin/applications/{applicationId}/lifecycle-commands`, `POST /admin/applications/{applicationId}/inspection` |
| 변경 승인 | `GET /applications/{applicationId}/change-request`, `POST /applications/{applicationId}/change-request/approve`, `POST /applications/{applicationId}/change-request/reject` |
| 이벤트 | `POST /events` (Bearer 인증 필수) |

현재 브라우저 Fixture 화면이 이 경로를 호출한다는 뜻은 아니며, 실제 Supabase/OpenAI 연결 완료를 뜻하지도 않습니다.

### 이벤트 보안

`POST /events`는 Bearer 인증을 요구합니다. 서버는 event name과 metadata key/value를 allowlist로 제한하고, `analysisId`·`productId`·`applicationId`가 있으면 요청 사용자가 해당 리소스를 볼 수 있는지 RLS로 확인합니다. 사용자당 최근 1분 이벤트 수가 한도를 넘으면 `429`를 반환합니다. DB는 `anon`·`authenticated` 직접 INSERT를 허용하지 않으며 검증을 마친 서버만 service role로 기록합니다.

## 10. 구현·검증 체크리스트

- [x] Presign은 요청당 1~4개, 분석 생성은 정확히 6개 제한을 서로 다르게 적용한다.
- [x] 소스 업로드는 JPG/PNG와 파일당 10 MiB만 허용한다.
- [x] 분석 요청의 제품 정보 필수·선택 필드를 구분한다.
- [x] 분석 enum을 OpenAPI, TypeScript, SQL, Mock에서 동일하게 사용한다.
- [x] 모든 분석 예상 결과에 `estimateMeta`와 `authenticityPrecheck.notice`를 노출한다.
- [x] 주문 생성 시 `pickupSchedule`과 정확히 세 개의 필수 동의 키를 검증·저장한다.
- [x] 결제 성공 직후 `ORDER_PLACED` 이력을 남기고 대상 상태가 맞지 않으면 결제까지 롤백한다.
- [x] 운영자 lifecycle command는 즉시 다음 상태, 멱등 키, 역할 권한과 409 guard를 검증한다.
- [x] `SHIPPED` command에서 운송장을 만들고 중앙 배송 Fixture `DEMO-RB-20260817-0001`과 필드명을 맞춘다.
- [x] `CHANGE_REQUIRED` 검수와 `PENDING` 변경안·상태 이력을 DB RPC 한 트랜잭션으로 저장한다.
- [x] 실물 검수와 변경안 승인 전 제작 시작을 서버·DB에서 차단한다.
- [x] `PRODUCTION_UNAVAILABLE`은 안내·Mock 결제 취소 후 `CANCELED`로만 전환한다.
- [x] 대표 Fixture 주문은 `RB-20260817-0001` 하나만 사용한다.
- [x] 보증서에는 실물 검수 후 확정된 68%, 2,860 cm², 3.43 kgCO₂e 값을 사용한다.

위 체크는 저장소 코드·계약 구현 상태다. 실제 Supabase migration·Auth/RLS/Storage/RPC와 OpenAI LIVE 호출은 아직 검증되지 않았으므로 [`SETUP_GUIDE.md`](SETUP_GUIDE.md)의 staging 체크리스트는 별도로 모두 통과해야 한다.

### 기존 DB migration·rollback

- 신규 DB는 `supabase-schema.sql`을 bootstrap 기준으로 사용합니다.
- 기존 DB는 `supabase/migrations/202608180001_lifecycle_integrity.sql`을 적용합니다. 이 migration은 수거 일정·동의와 `CHANGE_REQUIRED.proposed_terms`를 backfill한 뒤 제약을 검증하고 lifecycle RPC·보증서 trigger를 설치합니다.
- 이어서 `supabase/migrations/202608180002_capture_four_views.sql`을 적용해 이전 정확히 4장 guard를 설치한 뒤, `supabase/migrations/202608180003_capture_seven_views.sql`을 적용합니다. 003 migration은 `analysis_images.display_order`를 0~6으로 확장하고 분석 상태 전이 시 정면·후면·상단·하단·좌측면·우측면·일련번호 사진이 정확히 7장인지 DB에서도 강제합니다. 기존 완료 분석은 이력으로 유지하고, 진행 중인 4장 분석은 사진을 임의 생성하지 않으며 나머지 세 사진을 받은 뒤 다음 상태로 진행합니다.
- 다음으로 `supabase/migrations/202608180004_backend_v2_runtime.sql`을 적용합니다. 004는 네 제품의 canonical Product3D JSON을 보존하되 실제 자산 준비 전 `model_3d_ready=false`로 두고, 상태가 맞지 않는 PAID 결제를 원자적으로 거부하며, 고객 변경안 결정이 RLS를 우회해 권한을 넓히지 않도록 `auth.uid()`·소유권·`PENDING`을 재검증하는 `SECURITY DEFINER` trigger를 설치합니다. 또한 이벤트 enum·server-only INSERT·rate-limit index, matching `PENDING` metadata가 필요한 Storage 정책, 외부 AI 동의 증적, `applications.analysis_id` unique·terms 제약과 여권지갑 optionGroups를 정합화합니다.
- 이어서 `supabase/migrations/202608190005_shipment_conflict_hotfix.sql`을 적용합니다. 005는 lifecycle RPC의 배송 upsert에서 `application_id` 출력 변수와 컬럼이 충돌하지 않도록 `mock_shipments_application_id_key` 명명 제약조건을 사용하며, HTTP 계약이나 업무 데이터는 변경하지 않습니다.
- 이어서 `supabase/migrations/202608190006_customer_decision_gate.sql`을 적용합니다. 006은 실물 검수 결과가 `CHANGE_REQUIRED`일 때 고객의 `APPROVED` 결정이 저장되기 전에는 `PRODUCTION_READY`로 우회 전환할 수 없도록 lifecycle RPC와 DB transition trigger를 함께 보강합니다.
- 저장소 migration 순서에 따라 `supabase/migrations/202608200007_generic_source_pattern_copy.sql` 다음 `supabase/migrations/202608210008_capture_six_views.sql`을 적용합니다. 008은 기존 `display_order=6` 일련번호 사진 연결을 private backup에 보존한 뒤 분석에서 해제하고, `analysis_images.display_order`를 0~5로 제한하며 상태 전이 시 여섯 방향 사진이 정확히 6장인지 강제합니다. 원본 `media_assets`와 private Storage 객체는 삭제하지 않습니다.
- legacy 동의 키의 자동 변환은 정확히 모두 `true`인 `PRIMARY_SCENARIO` 데모 행으로 제한합니다. 기존 주문에 최초 이력이 없으면 `created_at` 시각의 `PENDING_PAYMENT`를 `MIGRATION_BACKFILL_INITIAL_STATUS` 표식으로 보완합니다.
- 증명할 수 없는 동의·변경안·기존 보증서가 있으면 migration은 값을 만들어 내지 않고 중단합니다. 운영자가 해당 행을 검토한 뒤 재실행해야 합니다.
- 구조 롤백은 쓰기를 중지한 뒤 `supabase/rollbacks/202608180001_lifecycle_integrity.sql`을 사용합니다. migration 뒤 생성된 주문이 있으면 자동 롤백을 중단하므로 별도 매핑 또는 point-in-time restore가 필요합니다.
- 6장 사진 계약을 되돌릴 때는 앱·API도 함께 중지한 뒤 `supabase/rollbacks/202608210008_capture_six_views.sql`을 먼저 적용합니다. 008 rollback은 백업한 일련번호 사진 연결을 복구하고 `display_order` 0~6, 정확히 7장 guard로 되돌립니다. 백업 대상 분석이나 미디어가 삭제됐거나 연결이 충돌하면 값을 만들거나 덮어쓰지 않고 중단합니다. 더 이전의 4장 계약까지 되돌릴 때만 `supabase/rollbacks/202608180003_capture_seven_views.sql`과 `supabase/rollbacks/202608180002_capture_four_views.sql`을 차례로 적용합니다.
- 전체 롤백은 `supabase/rollbacks/202608210008_capture_six_views.sql`, `supabase/rollbacks/202608200007_generic_source_pattern_copy.sql`, `supabase/rollbacks/202608190006_customer_decision_gate.sql`, `supabase/rollbacks/202608190005_shipment_conflict_hotfix.sql`, `supabase/rollbacks/202608180004_backend_v2_runtime.sql` 순서로 적용합니다. 008 rollback은 분석 계약을 정확히 7장으로 되돌리므로 앱·API도 함께 되돌릴 때만 사용합니다. 006 rollback은 고객 승인 전 제작 진행 우회를 다시 만들므로 앱도 함께 되돌릴 때만 사용합니다. 005 rollback은 배송 시작 결함을 다시 만들므로 앱도 함께 되돌릴 때만 사용합니다. 004 rollback은 migration 당시 private backup으로 제품 JSON·trigger·정책·권한을 복원하며, migration 뒤 해당 값이 바뀌었거나 실제 LIVE 동의 증적 행이 있으면 덮어쓰거나 증적을 삭제하지 않고 중단합니다.

## 11. v1 → v2 마이그레이션 이력

이 절의 이름은 과거 계약을 식별하기 위한 이력이며, 신규 구현에 사용하면 안 됩니다.

| v1 historical | v2 current |
|---|---|
| “2주 MVP”, Phase2 후속 구현 구분 | 서비스 데모 MVP의 전체 발표 흐름을 한 계약으로 구현 |
| JPG/PNG/WebP, 파일당 6MB | JPG/PNG, 파일당 10 MiB (`10485760`) |
| `SOURCE_PRODUCT`, `DAMAGE_CLOSEUP`, `SERIAL` | `SOURCE_FRONT`, `SOURCE_SIDE`, `INTERIOR`, `ENGRAVING` |
| `FIXTURE`, `FIXTURE_FALLBACK` | `DEMO_FIXTURE`, `SEEDED_ESTIMATE`, `LIVE` |
| `authenticitySignal: REVIEW_REQUIRED`와 주문 전 수동 검토 | `authenticityPrecheck`; 주문 가능성 신호만 제공하고 전문가는 주문 후 실물 검수 |
| `PENDING_APPROVAL`, 운영자 `/approve`, `APPROVED` | 결제 성공 `ORDER_PLACED`; 주문 후 `/inspection`과 고객 변경 승인/거절 |
| `RECEIVING_PRODUCT`, `ADDITIONAL_REVIEW_REQUIRED` | 세분화된 수거·검수·변경 승인 상태 머신 |
| `reusableMaterialRate` | `estimatedReusableMaterialRate` |

기존 v1 클라이언트와 DB enum은 v2와 호환되지 않으며 `/api/v1` Route Handler도 이 브랜치에서 제거했습니다. 이 migration 체인은 `origin/feature-backend` v1 DB의 in-place 변환을 지원하지 않습니다. 보존 데이터가 있으면 실제 백업을 기준으로 전용 변환 migration을 별도 설계하고, 데모 데이터뿐이면 신규·빈 v2 staging에 최종 bootstrap을 적용합니다.
