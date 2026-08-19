# MCM RE:BORN v2 백엔드 설정 가이드

이 문서는 API 계약 `v2.0.0`의 23개 Route Handler 파일·25개 operation을 로컬 또는 staging Supabase 프로젝트에 연결하는 절차다. 실행 앱은 저장소의 `mcm-reborn/`에 있고 HTTP 기준은 루트 `openapi.yaml`, 신규 DB 기준은 `supabase-schema.sql`이다.

> 2026-08-19 현재 `mcm-reborn/.env.local`에 Supabase 환경변수가 설정되어 `/api/v2/health` 연결은 확인됐다. 비밀값과 실제 계정 자격증명은 저장소에 기록하지 않으며, 전체 7장 업로드·신청·운영 전이·보증서 원격 여정은 staging에서 별도로 검증해야 한다.

## 1. 사전 준비

- Node.js와 npm
- 별도의 Supabase 개발 또는 staging 프로젝트
- Supabase 프로젝트의 URL, publishable key, service role key
- 신규 DB인지 기존 DB인지에 대한 명확한 확인
- 데모 로그인을 사용할 경우 CUSTOMER와 OPERATOR용 별도 Auth 사용자

실제 고객 데이터나 운영 프로젝트를 초기 연결 시험에 사용하지 않는다. service role key, 비밀번호, access token은 저장소·이슈·로그에 기록하지 않는다.

## 2. 로컬 환경변수

저장소 루트의 `.env.example`이 환경변수 이름의 기준이다. 저장소 루트에서 아래 중 현재 셸에 맞는 명령을 실행한다.

```powershell
Copy-Item .\.env.example .\mcm-reborn\.env.local
```

```bash
cp .env.example mcm-reborn/.env.local
```

`mcm-reborn/.env.local`은 Git에 커밋하지 않는다. 값은 다음 원칙으로 채운다.

```dotenv
# 브라우저에 포함될 수 있는 공개 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 서버 전용: NEXT_PUBLIC_ 접두사를 붙이지 않는다
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.6

# LIVE private-image processing is opt-in
ENABLE_EXTERNAL_AI=false
EXTERNAL_AI_PRIVACY_NOTICE_VERSION=

# DEMO_FIXTURE | SEEDED_ESTIMATE | LIVE
AI_MODE=DEMO_FIXTURE

DEMO_TIMELINE_PROFILE=PRIMARY_SCENARIO
DEMO_SCENARIO_KEY=MCM_BACKPACK_CHANGE_APPROVED_20260817

# 로컬·통제된 staging 데모에서만 true
ENABLE_DEMO_LOGIN=false
DEMO_CUSTOMER_EMAIL=your-demo-customer@example.com
DEMO_CUSTOMER_PASSWORD=use-a-secret-value
DEMO_OPERATOR_EMAIL=your-demo-operator@example.com
DEMO_OPERATOR_PASSWORD=use-a-different-secret-value
```

보안 원칙:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 공개 클라이언트에 사용할 수 있다.
- `SUPABASE_SERVICE_ROLE_KEY`, 데모 비밀번호, OpenAI 키는 서버 런타임에서만 읽는다.
- 운영 환경에서는 `ENABLE_DEMO_LOGIN=false`로 두고 데모 계정 로그인을 노출하지 않는다.
- demo-login은 비밀번호를 코드에 내장하지 않는다. 서버 환경변수와 Supabase Auth 사용자의 실제 자격 증명이 일치해야 한다.
- `AI_MODE=LIVE`는 `ENABLE_EXTERNAL_AI=true`, 현재 privacy notice version, 요청별 명시 동의와 DB 증적이 모두 준비된 제한된 환경에서만 사용한다. 기본 데모는 `DEMO_FIXTURE`다.

## 3. DB 적용 경로 선택

신규 DB와 기존 DB 절차를 섞지 않는다. 실행 전에 Supabase 프로젝트가 비어 있는지, 기존 MCM RE:BORN 스키마와 데이터가 있는지 확인한다.

### 3.1 신규·빈 Supabase 프로젝트

Supabase Dashboard의 SQL Editor에서 루트 `supabase-schema.sql` 전체를 한 번 적용한다. 이 파일은 현재 v2 최종 상태의 bootstrap이며, 별도 migration 001~006을 다시 실행하지 않는다.

bootstrap은 다음을 포함한다.

- `CUSTOMER`, `OPERATOR` 역할과 profiles
- media assets, 분석·추천, 신청·상태 이력, Mock 결제·배송, 실물 검수·변경안, 보증서, 이벤트, 멱등성 테이블
- 현재 주문 lifecycle enum·제약·RPC·trigger
- `COMPLETED` 이전 보증서 생성을 차단하는 DB 무결성 규칙
- 정확히 7개 분석 이미지 규칙
- OpenAPI Product3D 필수 필드가 모두 들어 있는 네 제품의 `model_3d`
- 실제 GLB/poster 준비 전 3D 노출을 막는 `model_3d_ready=false`
- 결제 상태 불일치 시 전체 결제를 중단하는 Mock 결제 trigger
- 고객 JWT 소유권을 재검증하는 변경안 결정 trigger
- 인증 이벤트 enum·server-only INSERT·rate-limit index
- matching `PENDING` media metadata와 연결된 private Storage 쓰기 정책
- 외부 AI 동의 증적, 신청별 분석 unique·terms 제약과 canonical 제품 optionGroups
- RLS 정책과 private Storage bucket
- 데모 제품 seed

적용 후 SQL Editor의 성공 표시만 믿지 말고 아래 staging 체크리스트로 테이블, 정책, RPC와 실제 요청을 확인한다.

### 3.2 lifecycle migration 이전의 v2 데모 DB

아래 migration은 `supabase/README.md`에 설명된 **기존 v2 데모 DB**를
대상으로 한다. 기존 DB에는 `supabase-schema.sql`을 덮어쓰지 않는다. 백업과 적용
창구를 확인한 뒤 SQL Editor에서 아래 파일을 순서대로 적용한다.

1. `supabase/migrations/202608180001_lifecycle_integrity.sql`
2. `supabase/migrations/202608180002_capture_four_views.sql`
3. `supabase/migrations/202608180003_capture_seven_views.sql`
4. `supabase/migrations/202608180004_backend_v2_runtime.sql`
5. `supabase/migrations/202608190005_shipment_conflict_hotfix.sql`
6. `supabase/migrations/202608190006_customer_decision_gate.sql`

002는 과거 4장 계약을 반영하는 중간 migration이고, 003이 현재의 6면+일련번호 총 7장 계약으로 대체한다. 기존 DB의 적용 이력을 재현하기 위해 순서를 생략하지 않는다. 4장 상태의 진행 중 분석은 사진을 임의 생성해 backfill하지 않으며, 나머지 구도와 일련번호 사진을 보완한 뒤 진행한다.

004는 네 제품의 `model_3d`를 OpenAPI Product3D와 같은 canonical Mock 값으로 정렬하되 실제 자산 준비 전 `model_3d_ready=false`를 유지하고, PAID 결제가 `PENDING_PAYMENT` 주문을 실제로 갱신하지 못하면 결제 트랜잭션을 중단한다. 고객 변경안 결정은 `SECURITY DEFINER` trigger 안에서 `auth.uid()`·주문 소유권·`PENDING` 상태를 다시 검사한다. 이벤트 server-only INSERT, Storage metadata binding, 외부 AI 동의 증적, 신청·terms·option 제약도 함께 적용한다. 적용 전의 변경 대상 정의·권한은 private backup에 보존한다.

`origin/feature-backend`의 v1 SQL을 실제 프로젝트에 적용한 적이 있다면 이 migration을
바로 실행하지 않는다. v1은 테이블·컬럼·enum과 주문 승인 의미가 달라 001의 전제와
호환되지 않는다. 이번 작업 환경에서는 해당 v1 DB가 실제로 존재한다는 증거가 없으므로
자동 변환을 추정해 제공하지 않는다. 별도 백업에서 v1 데이터 모양을 확인해 전용
v1→v2 변환 migration을 작성하거나, 보존할 데이터가 없는 개발 프로젝트라면 신규
staging 프로젝트에 최종 bootstrap을 적용한다.

구조 롤백 파일은 `supabase/rollbacks/`에 있다. 롤백이 필요하면 데이터 손실과 API 호환성을 검토하고 `006 → 005 → 004 → 003 → 002 → 001` 역순으로 수행한다. 006 rollback은 고객 승인 전 제작 진행 우회를 다시 허용하므로 앱까지 함께 되돌릴 때만 사용한다. 005 rollback은 배송 시작 결함을 다시 만들므로 앱까지 함께 되돌릴 때만 사용한다. 004 rollback은 migration 뒤 제품 JSON, trigger·정책·보호 권한이 바뀌었거나 실제 LIVE 동의 증적이 있으면 자동 복원을 중단한다. OpenAPI, 앱과 DB 중 한쪽만 단독 롤백하지 않는다.

## 4. Supabase Auth와 profiles 연결

Supabase Dashboard의 Authentication에서 이메일 기반 사용자 두 명을 생성한다.

| 계정 | profiles.role | 용도 |
|---|---|---|
| 데모 고객 | `CUSTOMER` | 본인 촬영·분석·신청 리소스 접근 |
| 데모 운영자 | `OPERATOR` | 운영 조회와 guarded lifecycle command |

생성한 사용자의 UUID를 확인한 뒤 SQL Editor에서 profile을 연결한다. 아래 UUID와 표시명은 실제 staging 값으로 교체한다.

```sql
insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'CUSTOMER', '데모 고객'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'OPERATOR', '데모 운영자')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;
```

- UUID는 이메일 문자열을 추측해 만들지 말고 `auth.users`에 실제 생성된 ID를 사용한다.
- CUSTOMER와 OPERATOR는 서로 다른 Auth 사용자여야 한다.
- 별도 장인 역할은 현재 v2 계약에 없다. 장인용 콘솔 표현도 `OPERATOR` 권한 경계 안에서 동작한다.
- 고객 JWT로 다른 고객 profile 또는 리소스가 조회되지 않는지 반드시 확인한다.

## 5. Private Storage 확인

`supabase-schema.sql`은 `source-products` bucket을 private으로 만들고 다음 제약을 적용한다.

- JPG/JPEG·PNG만 허용
- 파일당 최대 10MB
- 경로 첫 segment가 인증 사용자 UUID와 일치해야 함
- 소유 고객과 OPERATOR만 읽을 수 있음
- 공개 URL이 아닌 signed upload/read URL 사용

`POST /api/v2/uploads/presign`은 고객 인증과 역할 검사를 마친 뒤 서버가 service role로 소유 고객의 `PENDING` `media_assets` metadata를 먼저 예약하고, 고객 JWT로 Storage RLS를 통과해 matching object의 signed upload URL을 만든다. Storage INSERT는 같은 사용자·경로의 `PENDING` metadata가 있어야 하며, 고객 삭제는 소유 `PENDING` 자산이면서 `analysis_images`에 연결되지 않은 경우만 허용한다. service role key를 응답, 브라우저 코드 또는 로그에 포함해서는 안 된다.

Dashboard에서 bucket을 수동으로 public으로 바꾸지 않는다. 업로드 시험 후 인증 없는 요청과 다른 CUSTOMER 토큰으로 원본을 읽을 수 없는지 확인한다.

## 6. 앱 실행과 정적 검증

저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
npm --prefix mcm-reborn run dev
```

계약 패키지도 검증한다.

```bash
python validate_package.py
```

현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없다. 테스트가 통과했다고 표현하지 말고 아래 staging 요청을 수동·통합 검증 기록으로 남긴다.

## 7. v2 health 판정

상태 확인 URL은 다음과 같다.

```text
GET http://localhost:3000/api/v2/health
```

health는 항상 HTTP `200`으로 계약 응답을 반환한다.

```json
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2026-08-18T00:00:00.000Z",
  "aiMode": "DEMO_FIXTURE"
}
```

`status: ok` 조건:

- Supabase URL, publishable key, service role key가 존재하고 URL 형식이 허용됨
- `AI_MODE`가 `DEMO_FIXTURE`, `SEEDED_ESTIMATE`, `LIVE` 중 하나임
- `LIVE`이면 외부 AI opt-in, privacy notice version, OpenAI key/model이 모두 존재함
- demo-login이 활성화된 경우 네 개의 데모 계정 환경변수가 모두 존재함
- public Supabase 클라이언트가 제한 시간 안에 `products` 테이블을 실제 조회함

설정 누락, 잘못된 AI mode, DB/RLS/네트워크 조회 실패 중 하나라도 있으면 응답 본문만 `status: degraded`가 된다. 누락된 변수명, URL, 키, DB 원본 오류는 응답에 노출하지 않는다. 따라서 HTTP 200만 확인하지 말고 반드시 `status` 값을 모니터링한다.

현재처럼 Supabase 환경변수가 없는 로컬 환경에서는 다음과 같이 동작하는 것이 정상이다.

```json
{
  "status": "degraded",
  "version": "2.0.0",
  "timestamp": "...",
  "aiMode": "DEMO_FIXTURE"
}
```

## 8. 데모 로그인과 인증 확인

데모 로그인은 로컬 또는 접근이 제한된 staging에서만 활성화한다.

```bash
curl -X POST http://localhost:3000/api/v2/auth/demo-login \
  -H "Content-Type: application/json" \
  -d '{"demoAccount":"CUSTOMER"}'
```

- `ENABLE_DEMO_LOGIN=false` 또는 미설정: `403 FORBIDDEN`
- 활성화됐지만 서버 자격 증명이 누락됨: `503 SERVICE_UNAVAILABLE`
- Supabase Auth 사용자·비밀번호·profile이 일치함: `200`과 user/session
- 요청한 demoAccount와 profile role이 다름: `403 FORBIDDEN`

받은 access token은 로컬 셸 변수나 API 도구의 비밀 저장소에만 잠시 보관한다.

```bash
curl http://localhost:3000/api/v2/me \
  -H "Authorization: Bearer <customer-access-token>"
```

`/me`가 CUSTOMER와 OPERATOR 각각의 `id`, `role`, `displayName`, `email`을 반환하는지 확인한다. 토큰이 없거나 만료·변조되면 `401`이어야 한다.

## 9. staging 실제 연동 체크리스트

다음 항목이 모두 확인되기 전에는 “Supabase 연동 완료”로 보고하지 않는다.

### 환경·배포

- [ ] staging에 URL, publishable key와 service role key가 설정되어 있다.
- [ ] service role key와 데모 비밀번호가 브라우저 bundle, 응답, 저장소와 로그에 없다.
- [ ] `AI_MODE`가 의도한 모드이며 `GET /api/v2/health` 본문이 `status: ok`다.
- [ ] `LIVE`이면 외부 AI opt-in·현재 privacy notice·요청별 동의·증적 저장을 검증했고, 아니면 `ENABLE_EXTERNAL_AI=false`다.
- [ ] 운영 배포에서는 `ENABLE_DEMO_LOGIN=false`다.

### DB·migration

- [ ] 신규 DB는 bootstrap만, 기존 DB는 migration 001→002→003→004→005→006만 적용했다.
- [ ] lifecycle RPC와 trigger가 존재하고 허용된 인접 상태 전이만 성공한다.
- [ ] `COMPLETED` 이전 보증서 생성이 DB에서 거부된다.
- [ ] 최종 분석 진행에는 정확히 7개 이미지가 필요하다.
- [ ] 네 제품의 `model_3d`가 Product3D 필수 필드를 모두 포함한다.
- [ ] 실제 GLB/poster가 없는 제품은 `model_3d_ready=false`이며 API가 `has3d=false`, `model3d=null`을 반환한다.
- [ ] PAID 결제의 대상 주문이 `PENDING_PAYMENT`가 아니면 결제 행까지 롤백된다.
- [ ] 변경안 결정은 소유 CUSTOMER JWT만 성공하고 주문·상태 이력이 함께 기록된다.
- [ ] `analysis_external_ai_consents`는 서버만 쓰고 소유 CUSTOMER만 읽는다. LIVE 요청은 외부 전송 전에 증적을 만들고 완료 후 `analysis_id`를 연결한다.
- [ ] 같은 분석으로 두 신청을 만들 수 없고 선택 옵션·최종 조건 제약이 우회 쓰기에도 적용된다.
- [ ] 기존 데이터를 사용했다면 migration 전 백업과 적용 결과를 기록했다.

### Auth·RLS

- [ ] CUSTOMER/OPERATOR Auth 사용자와 profiles 행이 각각 연결되어 있다.
- [ ] 무인증 `/api/v2/me`가 `401`, 두 역할의 정상 토큰은 `200`이다.
- [ ] CUSTOMER는 자신의 리소스만 읽고 다른 고객 ID에는 접근할 수 없다.
- [ ] CUSTOMER 토큰으로 운영자 lifecycle command가 `403`이다.
- [ ] OPERATOR 토큰과 멱등성 키로 허용된 lifecycle command가 한 번만 적용된다.

### Storage·이벤트

- [ ] CUSTOMER의 presign 요청이 JPG/PNG, 1~4개, 장당 10MB 계약에서 `201`이다.
- [ ] OPERATOR의 고객 업로드 presign 요청은 `403`이다.
- [ ] signed URL로 업로드한 뒤 private object를 인증 없이 읽을 수 없다.
- [ ] 다른 CUSTOMER 토큰으로 해당 object와 media asset을 읽을 수 없다.
- [ ] matching `PENDING` media metadata가 없는 Storage object INSERT가 거부된다.
- [ ] 분석에 연결됐거나 `UPLOADED`인 media asset을 고객이 삭제할 수 없다.
- [ ] `/api/v2/events`는 Authorization 헤더가 없거나 토큰이 잘못되면 `401`이다.
- [ ] 정상 CUSTOMER 이벤트는 허용 event/metadata와 본인이 볼 수 있는 참조만 `202`이며 rate limit 초과는 `429`다.
- [ ] `anon`/`authenticated` 역할의 `analytics_events` 직접 INSERT가 거부된다.

### 실패 응답

- [ ] JSON 오류는 `{ error: { code, message, requestId, details } }` 형태다.
- [ ] Supabase 중단 또는 잘못된 설정에서 성공 응답을 가장하지 않는다.
- [ ] 오류 응답과 서버 로그에 key, token, 비밀번호, 업로드 원본 URL과 개인정보가 없다.

## 10. 문제 해결

### health가 `degraded`인 경우

1. `mcm-reborn/.env.local`의 세 Supabase 변수가 비어 있지 않은지 확인한다.
2. Supabase URL이 HTTPS인지 확인한다. HTTP는 localhost 계열 개발 URL만 허용된다.
3. `AI_MODE` 철자와 대문자 enum을 확인한다.
4. demo-login이 true라면 네 개 계정 환경변수를 확인한다.
5. SQL Editor에서 `products`와 RLS가 적용됐는지 확인한다.
6. 앱 서버에서 Supabase REST endpoint로 네트워크 연결이 가능한지 확인한다.

### demo-login이 `403`인 경우

- `ENABLE_DEMO_LOGIN=true`인지 확인한다.
- 요청한 `demoAccount`와 profiles.role이 같은지 확인한다.
- 운영 환경에서 의도적으로 비활성화한 경우 403이 정상이다.

### demo-login 또는 API가 `503`인 경우

- 서버 환경변수 누락 여부를 확인한다.
- Supabase Auth·REST·Storage 상태와 staging 네트워크를 확인한다.
- 내부 오류를 클라이언트에 상세 노출하는 방식으로 우회하지 않는다.

### Storage가 권한 오류를 반환하는 경우

- bucket 이름이 `source-products`이고 private인지 확인한다.
- 업로드 경로가 `<auth-user-uuid>/<asset-uuid>.<ext>` 형식인지 확인한다.
- Auth 토큰 사용자와 경로 첫 segment가 같은지 확인한다.
- bootstrap 또는 migration과 Storage RLS 정책의 실제 적용 상태를 확인한다.

### relation 또는 RPC가 없다는 오류가 발생하는 경우

- 신규/기존 DB 적용 경로를 다시 확인한다.
- 기존 DB migration을 001→002→003→004→005→006 순서로 모두 적용했는지 확인한다.
- production 데이터가 있는 환경에서 bootstrap 재적용으로 해결하지 않는다.

## 11. 완료 기록

staging 검증 결과에는 다음을 남긴다.

- 적용한 Supabase 프로젝트 환경 이름과 DB 경로(bootstrap 또는 migration)
- migration 파일과 적용 시각, 수행자, 백업·롤백 판단
- 확인한 CUSTOMER/OPERATOR 권한 시나리오
- health의 실제 본문과 주요 API 상태 코드
- Storage private 접근 검증 결과
- 실행한 lint, typecheck, build, 계약 검사 결과
- 실제 Supabase에서 확인하지 못한 항목과 남은 위험

키, 비밀번호, access token과 실제 고객 데이터는 완료 기록에도 포함하지 않는다.
