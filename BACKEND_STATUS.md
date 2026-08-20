# 백엔드 v2 통합 상태

기준 브랜치는 `feature-backend-v2-integration`이며 `origin/feature-backend`
(`5dc293e`)에서 분기했다. HTTP 계약은 `openapi.yaml`의 API 계약 v2.0.0
(OpenAPI 3.1.0), 데이터 구조는 `supabase-schema.sql`과
`supabase/migrations/`, 제품 흐름은 `docs/MVP_DEMO_CANONICAL.md`를 따른다.

## 판정 요약

- `feature-backend`에는 Supabase Auth·Database·Storage를 호출하는 코드와 RLS
  SQL이 있었지만, 프로젝트 URL·키·CLI link·적용된 migration·실행 검증 기록은
  없었다. 따라서 **Supabase 연동 코드가 존재했을 뿐 실제 프로젝트 연결은
  확인되지 않았다.**
- 기존 `/api/v1`은 주문 전 운영자 승인, 1~4장 분석, 시간 기반 자동 상태 등
  현재 v2 흐름과 맞지 않고 코드가 참조하는 컬럼도 당시 SQL과 다수 불일치했다.
  이 브랜치는 v1을 제거하고 v2 계약에 맞춰 Route Handler와 서비스를 재작성했다.
- 로컬 저장소에는 실제 Supabase 값이 없다. 환경변수와 원격 프로젝트가 준비되지
  않은 상태에서 lint·typecheck·build·계약 검증은 가능하지만, Auth/RLS/Storage/RPC
  통합 성공을 의미하지 않는다.

## v2 API 범위

23개 `route.ts` 파일이 아래 25개 OpenAPI operation을 구현한다. GET/POST가 같은
collection 파일에 공존하는 두 곳 때문에 파일 수와 operation 수가 다르다. 모든
경로의 실제 URL에는 `/api/v2` 접두사가 붙는다.

| 영역 | Operation |
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
| 분석 이벤트 | `POST /events` |

고객·운영 콘솔 화면은 아직 중앙 Fixture를 사용하며 이 API에 연결되지 않았다.
또한 Route 파일과 정적 검증이 있다는 사실만으로 원격 Supabase/OpenAI에서
동작한다고 표시하지 않는다. 상세 설계는 `docs/BACKEND_V2_DESIGN.md`에 정리한다.

## 핵심 설계

### 인증과 권한

- Supabase access token을 `Authorization: Bearer ...`로 받는다.
- CUSTOMER는 본인 분석·신청만 읽고 변경 결정을 내릴 수 있다.
- OPERATOR는 신청 목록·상세, 실물 검수와 lifecycle command를 수행한다.
- service role이 필요한 쓰기는 사용자 인증과 리소스 소유권 또는 OPERATOR 역할을
  먼저 검증한 뒤 제한적으로 수행한다. service role 키는 응답·로그·클라이언트
  번들에 노출하지 않는다.

### 이미지와 분석

- 원본은 private `source-products` bucket의 사용자별 경로에 저장한다.
- presign은 한 요청에 1~4개씩 발급할 수 있지만 분석 생성은 정면·후면·상단·하단·
  좌측면·우측면의 정확히 6개 자산을 순서대로 요구한다. 일련번호 사진은 선택 기능이며 분석에 포함하지 않는다.
- 분석은 `DEMO_FIXTURE`, `SEEDED_ESTIMATE`, `LIVE` 모드를 지원하며 모두 사진 기반
  예상치로 표현한다.
- `LIVE`는 배포 opt-in·privacy notice·요청별 동의 증적이 있어야 하며 공식 OpenAI
  JavaScript SDK의 Chat Completions Structured Outputs를 사용한다. 제공자 장애에는
  Fixture로 폴백하지만 이미지 품질 실패는 폴백하지 않는다.

### 주문과 실물 검수

- Mock 결제 성공 후 `ORDER_PLACED`가 되며 주문 전 장인 승인 단계는 없다.
- 수거·제작·품질·배송은 OPERATOR lifecycle command와 DB transition guard로 바로
  다음 단계만 진행한다.
- `CHANGE_REQUIRED` 실물 검수는 검수·변경안·상태 이력을 하나의 RPC transaction으로
  생성한다.
- `COMPLETED` 전 보증서 생성은 DB trigger가 차단한다.

### 이벤트·제품 자산

- 이벤트는 Bearer 인증 필수이며 허용 event/metadata, 리소스 가시성과 사용자별
  rate limit을 확인한다. `anon`/`authenticated`의 직접 DB INSERT는 허용하지 않는다.
- Product3D JSON은 DB에 보존하지만 실제 GLB/poster가 준비되지 않은 제품은
  `model_3d_ready=false`이며 API가 3D를 노출하지 않는다.

## Supabase 연결 완료 기준

다음 항목을 모두 확인해야 “연결 완료”로 판정한다.

1. 추적되지 않는 `mcm-reborn/.env.local` 또는 배포 환경에 URL·publishable key·
   service role key가 설정되어 있다.
2. 신규 프로젝트에는 `supabase-schema.sql`, 호환되는 기존 v2 데모 DB에는 migration
   001→002→003→004→005→006→007→008이 실제 적용되었다. `feature-backend` v1 DB는 이 체인의 입력으로
   지원하지 않으므로 실제 백업에 맞춘 별도 변환 또는 빈 v2 staging을 사용한다.
3. CUSTOMER·OPERATOR Auth 사용자와 같은 UUID의 `profiles` 행이 존재한다.
4. `/api/v2/health`가 DB 연결을 확인하고 정상 상태를 반환한다.
5. CUSTOMER/OPERATOR 권한 거부, 필수 6장 업로드·분석, Mock 결제, 수거→검수→변경 승인→
   제작→배송→완료→보증서 흐름을 원격 DB에서 검증한다.
6. service role 없이 가능한 조회/RPC는 요청 JWT와 RLS가 실제로 적용됨을 확인한다.

현재 작업 환경은 1~6의 원격 실행 증거가 없으므로 **v2 코드 구현 / Supabase·OpenAI
실제 연결 미확인 / Fixture UI 미연결** 상태다.

## 남은 검증 공백

- 이 저장소에는 자동 API 통합 테스트 스크립트와 disposable Supabase/PostgreSQL
  runtime이 없다.
- migration과 rollback은 정적 검증만으로 충분하지 않다. staging 프로젝트에서
  적용·권한·원자성·롤백을 확인해야 한다.
- 멱등성 예약 뒤 프로세스가 종료되는 경우와 외부 AI/Storage 장애를 포함한 동시성
  테스트가 필요하다.
- `/operations` Fixture 콘솔은 실데이터를 연결하기 전에 OPERATOR 인증과 개인정보
  최소 노출을 적용해야 한다.

## 로컬 검증

저장소 루트에서 실행한다.

```bash
python -X utf8 validate_package.py
python -X utf8 scripts/validate_collaboration.py
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

`package.json`에는 자동 테스트 스크립트가 없다. 위 명령의 성공을 API 통합 테스트
성공으로 과장하지 않는다.
