# MCM RE:BORN API 구현 가이드

> 계약 버전: **2.0.0 (BREAKING)**
>
> 기준일: 2026-08-18
>
> 목적: 서비스 시연·데모 MVP의 프론트엔드, Route Handler, Mock, Supabase 구현 기준
>
> 구현 상태: 운영자 lifecycle command만 `mcm-reborn/app/api/v2/admin/applications/[applicationId]/lifecycle-commands` Route Handler와 Supabase RPC 연결이 구현되어 있습니다. Supabase 환경변수·운영자 JWT·migration이 준비된 환경에서 실행되며, 실물 검수와 나머지 API 및 고객 화면은 중앙 Fixture 또는 향후 구현 기준입니다.

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
- 쓰기 요청: `Idempotency-Key`를 전달합니다.
- 통화: `KRW`
- 시간: ISO 8601 UTC 저장, UI에서 Asia/Seoul로 표시
- 오류 형식: `{ "error": { "code", "message", "requestId", "details" } }`
- 외부 Provider 키와 service-role 키는 서버에서만 사용합니다.

## 3. 사진 업로드와 분석 생성

### 3.1 업로드 계약

| 항목 | v2 기준 |
|---|---|
| MIME | `image/jpeg`, `image/png` |
| 파일당 최대 크기 | `10485760` bytes (10 MiB) |
| 용도 | `SOURCE_FRONT`, `SOURCE_SIDE`, `INTERIOR`, `ENGRAVING` |
| Presign 1회 요청 | 1~4개 |
| 분석 생성에 연결할 사진 | 좌측면·우측면·하단·후면 4개 |

`POST /uploads/presign`은 점진 업로드를 위해 1개 사진만 요청해도 됩니다. 최종 `POST /analyses`에서는 업로드가 완료된 서로 다른 자산 4개를 좌측면·우측면·하단·후면 순서로 전달해야 합니다. 촬영 방향은 프런트 세션과 배열 순서로 관리하며 기존 Storage `purpose` enum을 방향별로 확장하지 않습니다. Route Handler를 구현할 때는 자산 소유자, 업로드 완료 여부, MIME, 크기, 목적을 다시 검증해야 합니다.

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
    "90000000-0000-4000-8000-000000000003"
  ],
  "category": "BACKPACK",
  "purchaseYear": 2019,
  "useDuration": "5년 이상",
  "desiredUse": "여권지갑",
  "conditionNote": "하단 모서리에 가벼운 마모가 있어요.",
  "locale": "ko-KR",
  "demoScenarioKey": "MCM_BACKPACK_CHANGE_APPROVED_20260817"
}
```

필수: `category`, `purchaseYear`, `useDuration`, `desiredUse`

선택: `serialNumber`, `conditionNote`

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

## 5. 주문과 결제

`POST /applications`는 기술적으로 주문을 생성합니다. 반환되는 `applicationId`가 전 구간에서 사용하는 단일 `orderId`입니다. `applicationNumber`는 사람이 읽는 주문 번호입니다.

주문 생성 시 분석이 `COMPLETED`, 이미지 품질이 `ACCEPTABLE`, `authenticityPrecheck.status`가 `ORDER_ELIGIBLE`인지 확인합니다. 생성 직후 상태는 `PENDING_PAYMENT`입니다.

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

향후 API 서비스 구현과 `supabase-schema.sql`의 DB trigger는 모두 이 규칙을 검사해야 합니다. UI에서 버튼을 숨기는 것만으로는 충분하지 않습니다.

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
| 원본 | MCM 비세토스 모노그램 백팩, 2019년, 5년 이상 |
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

| Method | Path | 역할 |
|---|---|---|
| POST | `/uploads/presign` | 소스 사진 점진 업로드 URL 발급 |
| POST | `/analyses` | 필수 구도 4장과 제품 정보로 분석 생성 |
| GET | `/analyses/{analysisId}` | 분석 상태·예상 결과 조회 |
| GET | `/products` | 최종 제품 4종 조회 |
| POST | `/applications` | 주문 생성 |
| POST | `/applications/{applicationId}/mock-payment` | 데모 결제, 성공 시 `ORDER_PLACED` |
| GET | `/applications/{applicationId}/timeline` | 주문 상태 이력 조회 |
| POST | `/admin/applications/{applicationId}/lifecycle-commands` | 운영자 수거·제작·품질·배송 상태 한 단계 진행 |
| POST | `/admin/applications/{applicationId}/inspection` | 주문 후 전문가 실물 검수 |
| GET | `/applications/{applicationId}/change-request` | 고객 변경안 조회 |
| POST | `/applications/{applicationId}/change-request/approve` | 고객 변경안 승인 |
| POST | `/applications/{applicationId}/change-request/reject` | 고객 변경안 거절·주문 취소 |
| GET | `/applications/{applicationId}/certificate` | 완료된 주문 보증서 조회 |

## 10. 구현·검증 체크리스트

- [ ] Presign은 1~4개, 분석 생성은 정확히 4개 제한을 서로 다르게 적용한다.
- [ ] 소스 업로드는 JPG/PNG와 파일당 10 MiB만 허용한다.
- [ ] 분석 요청의 제품 정보 필수·선택 필드를 구분한다.
- [ ] 분석 enum을 OpenAPI, TypeScript, SQL, Mock에서 동일하게 사용한다.
- [ ] 모든 분석 예상 결과에 `estimateMeta`와 `authenticityPrecheck.notice`를 노출한다.
- [x] 주문 생성 시 `pickupSchedule`과 정확히 세 개의 필수 동의 키를 저장할 DB 계약과 검증을 둔다. 주문 생성 Route Handler 연결은 별도다.
- [ ] 결제 성공 직후 `ORDER_PLACED` 이력을 남긴다.
- [x] 운영자 lifecycle command는 즉시 다음 상태, 멱등 키, 역할 권한과 409 guard를 검증한다.
- [x] `SHIPPED` command에서 운송장을 만들고 중앙 배송 Fixture `DEMO-RB-20260817-0001`과 필드명을 맞춘다.
- [x] `CHANGE_REQUIRED` 검수와 `PENDING` 변경안·상태 이력을 DB RPC 한 트랜잭션으로 저장한다. 실물 검수 Route Handler 연결은 별도다.
- [ ] 실물 검수와 변경안 승인 전 제작 시작을 서버·DB에서 차단한다.
- [x] `PRODUCTION_UNAVAILABLE`은 안내·Mock 결제 취소 후 `CANCELED`로만 전환한다.
- [ ] 대표 주문은 `RB-20260817-0001` 하나만 사용한다.
- [ ] 보증서에는 실물 검수 후 확정된 68%, 2,860 cm², 3.43 kgCO₂e 값을 사용한다.

### 기존 DB migration·rollback

- 신규 DB는 `supabase-schema.sql`을 bootstrap 기준으로 사용합니다.
- 기존 DB는 `supabase/migrations/202608180001_lifecycle_integrity.sql`을 적용합니다. 이 migration은 수거 일정·동의와 `CHANGE_REQUIRED.proposed_terms`를 backfill한 뒤 제약을 검증하고 lifecycle RPC·보증서 trigger를 설치합니다.
- 이어서 `supabase/migrations/202608180002_capture_four_views.sql`을 적용해 분석 상태 전이 시 좌측면·우측면·하단·후면의 업로드 사진이 정확히 4장인지 DB에서도 강제합니다. 기존 완료 분석은 이력으로 유지하고, 진행 중인 3장 분석은 사진을 임의 생성하지 않으며 네 번째 사진을 받은 뒤 다음 상태로 진행합니다.
- legacy 동의 키의 자동 변환은 정확히 모두 `true`인 `PRIMARY_SCENARIO` 데모 행으로 제한합니다. 기존 주문에 최초 이력이 없으면 `created_at` 시각의 `PENDING_PAYMENT`를 `MIGRATION_BACKFILL_INITIAL_STATUS` 표식으로 보완합니다.
- 증명할 수 없는 동의·변경안·기존 보증서가 있으면 migration은 값을 만들어 내지 않고 중단합니다. 운영자가 해당 행을 검토한 뒤 재실행해야 합니다.
- 구조 롤백은 쓰기를 중지한 뒤 `supabase/rollbacks/202608180001_lifecycle_integrity.sql`을 사용합니다. migration 뒤 생성된 주문이 있으면 자동 롤백을 중단하므로 별도 매핑 또는 point-in-time restore가 필요합니다.
- 사진 계약만 되돌릴 때는 역순으로 `supabase/rollbacks/202608180002_capture_four_views.sql`을 먼저 적용합니다. 이 롤백은 기존 3~4장 guard만 복원하며 저장된 사진이나 분석 이력은 삭제하지 않습니다.

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

기존 v1 클라이언트와 DB enum은 v2와 호환되지 않습니다. 같은 배포에서 OpenAPI 타입, Route Handler, 클라이언트 상태 매핑, SQL migration, Seed를 함께 교체해야 합니다.
