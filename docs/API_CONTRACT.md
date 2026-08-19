# API 계약 운영 규칙

> 2026-08-17 현재 제품 의미와 상태 전이는 [`MVP_DEMO_CANONICAL.md`](./MVP_DEMO_CANONICAL.md)를 따른다. 이전의 `REVIEW_REQUIRED` 신청 차단과 주문 전 `PENDING_APPROVAL → APPROVED` 흐름은 **superseded/historical**이다.

## 기준

- HTTP API의 기계 판독 기준은 `openapi.yaml`이다.
- 구현 의도와 예시는 `MCM_REBORN_API_GUIDE.md`, 데모 Fixture는 `mock-data.json`을 따른다.
- 영속 구조, 제약과 RLS의 기준은 `supabase-schema.sql`이다.
- 제품·데모 의미의 기준은 `docs/MVP_DEMO_CANONICAL.md`다.
- 현재 계약 버전은 `openapi.yaml`의 `info.version`, 기준 브랜치는 `develop`을 따른다.
- 현행 제품 계약은 **API 계약 v2.0.0**이고, `openapi.yaml`은 **OpenAPI 3.1.0** 형식이다. 제품 계약 버전과 명세 형식 버전을 혼용하지 않는다.

현재 실행 앱에는 `openapi.yaml`의 25개 API operation을 구현하는 23개 `/api/v2` Route Handler 파일이 있고, 고객·운영 콘솔 화면도 로그인 세션을 통해 이 API를 호출한다. API가 비어 있으면 빈 상태를, 인증·네트워크 오류면 오류 상태를 표시하며 중앙 Fixture로 조용히 대체하지 않는다. 실제 CUSTOMER/OPERATOR 자격증명을 사용한 전체 원격 여정과 OpenAI LIVE 호출은 별도 staging 검증으로 구분한다. 상세 구조는 [`BACKEND_V2_DESIGN.md`](./BACKEND_V2_DESIGN.md)를 따른다.

파일이 서로 다르면 조용히 UI만 우회하지 않는다. Canonical 흐름을 기준으로 차이, 소비자와 데이터 영향, 호환 가능한 선택지와 롤백을 기록하고 OpenAPI·Mock·DB·클라이언트·문서를 같은 변경 단위에서 정합화한다.

## 계약 변경으로 보는 항목

- URL, HTTP 메서드, 인증·권한, 헤더와 멱등성 정책
- 요청 파라미터·본문, 응답 필드, 상태 코드와 오류 형식
- 상태 전이, 열거값, 필수 여부, null 가능 여부와 기본값
- OpenAPI schema·example 또는 Mock 소비자가 의존하는 JSON 형태
- DB table·column·enum·constraint·index·RLS와 데이터 변환

내부 구현만 바뀌고 외부 관찰 결과가 같다면 그 근거를 PR에 남긴다.

## 현재 MVP 불변조건

- 분석 업로드는 정면·후면·상단·하단·좌측면·우측면 6면과 일련번호 사진, 총 7슬롯이 모두 필수다. 허용 형식은 JPG/JPEG·PNG, 파일당 최대 10MB다. Presign은 점진 업로드를 위해 한 번에 1~4개를 허용하므로 7장은 여러 요청으로 올릴 수 있고, 최종 `POST /analyses`는 일곱 자산 ID를 이 슬롯 순서대로 받는다.
- private Storage INSERT는 같은 사용자·경로의 `PENDING` `media_assets` metadata가 먼저 존재해야 한다. 고객 삭제는 소유 `PENDING` 자산이면서 분석에 연결되지 않은 경우만 허용한다.
- `POST /analyses`의 사진 품질 미달은 `422 IMAGE_QUALITY_INSUFFICIENT`다. `details.imageQuality.status`는 `RECAPTURE_REQUIRED`이며 각 문제에는 `assetId`, 문제 코드와 `guidanceKo`가 있다.
- 사진 품질 미달은 AI 제공자 장애가 아니므로 hybrid 폴백으로 성공 처리하지 않고 성공 분석도 생성하지 않는다.
- AI 분석 결과는 실제 모델, 중앙 Fixture 또는 재현 가능한 예상치일 수 있으며 분석 모드를 식별할 수 있어야 한다.
- `LIVE` 외부 이미지 처리는 배포 opt-in·고정 privacy notice·요청별 명시 동의와 증적 저장이 모두 필요하다. OpenAI 제공자 장애는 `DEMO_FIXTURE`로 폴백할 수 있지만 이미지 품질 실패는 폴백하지 않는다.
- 정품 사전 적합도는 주문 참고용 예상 신호다. 정품·가품 확정값으로 표시하지 않는다.
- UI의 `AI_COMPLETED`는 API `AnalysisStatus=COMPLETED`와 `authenticityPrecheck.status=ORDER_ELIGIBLE`의 조합이며, `AI_INELIGIBLE`은 같은 API 완료 상태와 `INELIGIBLE` 판정의 조합이다. 두 UI 상태를 별도 API enum으로 추가하지 않는다.
- 골든 시나리오의 예상 재활용률은 72%, 정품 사전 적합도 예상은 91%이며 주문 적합 경로로 진행한다.
- Mock 결제 성공은 주문 `RB-20260817-0001`을 `ORDER_PLACED`로 만든다. 주문 전 장인 승인이나 수동 검토 완료를 요구하지 않는다.
- 공식 장인 실물 검수는 `PRODUCT_RECEIVED` 뒤 `EXPERT_INSPECTION`에서만 수행한다.
- 실물 검수 결과가 `CHANGE_REQUIRED`이면 `CHANGE_APPROVAL_REQUIRED`에서 고객 결정을 기다린다. 승인 전에는 `IN_PRODUCTION`으로 이동하지 않는다.
- `CHANGE_REQUIRED` 검수에는 `proposedTerms`가 필수이며, 검수·변경안·주문 상태·상태 이력은 하나의 트랜잭션으로 생성한다. 성공 응답은 같은 트랜잭션에서 생성한 `changeRequest`를 반환한다.
- 골든 변경안은 재활용률 68%, 제작비 195,000원, 예상 기간 4~5주이며 고객 승인 후 `PRODUCTION_READY`로 이동한다.
- 수거·제작·품질·배송 상태는 운영자 전용 멱등 lifecycle command로 현재 상태의 바로 다음 단계만 진행한다. 제작·품질 단계의 `PRODUCTION_UNAVAILABLE`과 그 다음 `CANCELED`도 명시된 source 상태에서만 허용한다.
- 변경 거절 또는 `PRODUCTION_UNAVAILABLE`은 `CANCELED`와 Mock 결제 취소·환불 안내로 종료한다.
- canonical 배송 Fixture는 주문 `RB-20260817-0001`의 운송장 `DEMO-RB-20260817-0001`, 상태 `DELIVERED`다.
- `COMPLETED` 뒤에만 보증서 `ESG-RB-20260817-0001`을 발급하며 최종 재활용률 68%, 예상 탄소 절감량 3.43kg CO2e를 사용한다.
- 접수 `SUB-RB-20260817-0001`, 주문과 보증서는 서로 다른 식별자지만 동일 중앙 시나리오와 변경 이력을 가리킨다.
- `POST /events`는 Bearer 인증 필수다. 허용된 이벤트·metadata만 받고 연결 리소스 가시성·사용자별 rate limit을 확인하며, `anon`/`authenticated`의 직접 DB INSERT는 허용하지 않는다.

Canonical 주문 전이는 다음과 같다.

```text
PENDING_PAYMENT → ORDER_PLACED → PICKUP_SCHEDULED → PICKUP_IN_PROGRESS
→ PRODUCT_RECEIVED → EXPERT_INSPECTION → CHANGE_APPROVAL_REQUIRED
→ PRODUCTION_READY → IN_PRODUCTION → QUALITY_CHECK
→ SHIPPED → DELIVERED → COMPLETED
```

2026-08-17 이전의 아래 전이는 historical 호환 설명일 뿐 새 골든 경로의 불변조건이 아니다.

```text
PENDING_PAYMENT → PENDING_APPROVAL → APPROVED
REVIEW_REQUIRED → AWAIT_MANUAL_REVIEW → application creation blocked
```

## 2026-08-18 lifecycle 무결성 보완과 버전 판단

사용자는 `COMPLETED` 전 보증서 생성 차단, guarded lifecycle command, `CHANGE_REQUIRED` 검수와 변경안의 원자 처리, 기존 DB migration·backfill, canonical 배송 Fixture를 하나의 lifecycle 무결성 변경으로 명시 승인했다.

계약 버전은 `2.0.0`을 유지한다. 이 변경은 외부에 배포된 v2 서버가 없던 상태에서 승인된 breaking v2 계약의 누락을 완성했으며, lifecycle endpoint와 배송 Fixture는 추가 계약이다. 이후 lifecycle Route Handler가 이 계약의 첫 실행 경로로 추가되었다. `CHANGE_REQUIRED`에서 `proposedTerms`를 필수로 하는 조건은 이미 문서화된 변경안 생성 불변조건을 JSON Schema로 강제하는 보완이다. v2가 외부 소비자에게 배포된 뒤 동일한 필수 조건을 추가한다면 같은 버전을 덮어쓰지 않고 별도 계약 버전으로 올려야 한다.

호환되는 기존 v2 데모 DB에는 fresh bootstrap 파일을 재적용하지 않는다. `202608180001_lifecycle_integrity.sql`, `202608180002_capture_four_views.sql` 적용 뒤 `supabase/migrations/202608180003_capture_seven_views.sql`로 분석 전이의 정확히 7장 조건을 활성화하고, 마지막으로 `supabase/migrations/202608180004_backend_v2_runtime.sql`을 적용해 Product3D readiness·Mock 결제 상태 guard·고객 변경안 결정·이벤트·Storage metadata binding·외부 AI 동의 증적·신청/옵션 제약을 런타임 계약과 맞춘다. 사진을 합성하는 backfill은 하지 않으므로 진행 중인 4장 분석은 나머지 구도와 일련번호 사진을 보완한 뒤에만 계속할 수 있다. 롤백은 `supabase/rollbacks/202608180004_backend_v2_runtime.sql`부터 역순의 대응 파일을 사용하며 OpenAPI·DB 중 한쪽만 되돌리지 않는다. `origin/feature-backend` v1 DB는 이 migration 체인의 입력으로 지원하지 않는다.

관리자·장인 콘솔은 `OPERATOR` 권한으로 실제 신청 목록·상세를 조회하고 현행 v2 lifecycle command와 inspection API를 호출한다. 별도 장인 역할 enum은 추가하지 않는다. `feature-backend`의 `/api/v1` 목록·상세·`PENDING_APPROVAL → APPROVED` 계약은 이 문서의 상태 모델과 호환되지 않으므로 직접 소비하지 않는다.

## 변경 게이트

편집 전에 다음을 충족한다.

1. 계약 변경 전용 이슈와 변경 이유가 있다.
2. 기존 호출자, UI, 서버, 데이터와 데모 영향을 식별했다.
3. 하위 호환성, 마이그레이션과 롤백 방안을 작성했다.
4. 프런트엔드와 백엔드 담당자 모두 승인했다.
5. 변경이 `MVP_DEMO_CANONICAL.md`의 제품 의미와 일치하거나 제품 담당자가 새 결정을 승인했다.

승인이 없으면 영향 분석과 계약 제안까지만 작성하고 `openapi.yaml`, Mock, DB와 구현은 변경하지 않는다.

## 계약 우선 변경 순서

1. `openapi.yaml`의 schema와 성공·오류 example을 수정한다.
2. `mock-data.json`, 공유 타입과 상수를 동기화한다.
3. 서버 동작과 `supabase-schema.sql` 또는 별도 migration을 반영한다.
4. 클라이언트 호출과 로딩·빈 상태·오류·권한 UI를 반영한다.
5. 단위·통합·계약 테스트를 추가한다.
6. API 가이드와 관련 `docs/`를 갱신한다.

호환 가능한 추가 필드와 단계적 폐기를 우선하며, 여러 산출물을 장기간 불일치 상태로 남기지 않는다.

## 보안·데이터 검토

- 인증 주체, 리소스 소유권과 운영자 권한을 명시한다.
- RLS와 서버 권한이 서로 우회 경로를 만들지 않는지 확인한다.
- 생성·결제·승인 같은 쓰기는 중복 호출, 재시도와 멱등성 범위를 정의한다.
- DB 변경은 기존 데이터 변환, enum·constraint, index, rollback을 함께 설계한다.
- 오류는 내부 비밀값·개인정보를 노출하지 않으며 일관된 구조를 사용한다.
- Mock과 example에는 실제 고객·운영 데이터를 넣지 않는다.
- 예상치와 실물 검수 결과를 별도 필드·상태로 보존하고 변경 전 값을 덮어쓰지 않는다.
- 고객 변경 승인에는 대상 주문, 검수 버전과 승인·거절 멱등성 범위를 정의한다.

## 필수 검증

- YAML과 JSON 파싱, OpenAPI `$ref`, operationId와 example 정합성
- OpenAPI, Mock, 타입, 서버 응답과 DB 열거값·제약의 일치
- 정상, 오류, 빈 결과, 권한 거부와 외부 제공자 실패
- 상태 전이와 멱등 요청의 반복 실행
- migration 적용·롤백 또는 fresh bootstrap 조건

루트 계약 검증은 저장소 루트에서 실행한다.

```bash
python validate_package.py
```

앱의 계약 소비 코드가 바뀌면 저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `mcm-reborn/package.json`에는 테스트 스크립트가 없다. `npm test`를 실행하거나 자동 테스트가 통과했다고 표시하지 말고, 계약 검증과 완료 조건별 수동 검증 결과를 기록한다. 실행하지 못한 검사는 이유, 수동 확인 방법과 남은 위험을 PR에 남긴다.
