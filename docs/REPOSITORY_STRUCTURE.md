# 저장소 구조와 파일 소유권

이 저장소는 루트의 제품·협업 계약과 `mcm-reborn/`의 실행 앱을 분리한다. 기준 문서나 계약을 앱 폴더로 옮기거나 복제하지 않는다.

## 루트 소유 영역

| 경로 | 책임 |
|---|---|
| `AGENTS.md`, `AI_RULES.md`, `CONTRIBUTING.md` | 저장소 전체 협업·에이전트 규칙 |
| `docs/` | MVP 범위, 흐름, 계약 운영, 결정과 데모 기준. `docs/knowledge-base/`는 출처·시기·이미지 참조가 있는 공개 조사 위키 작성 원본 |
| `.agents/skills/` | 저장소 전용 에이전트 작업 절차 |
| `.github/` | Copilot 지침, 이슈·PR 템플릿 |
| `openapi.yaml` | HTTP API의 기계 판독 기준 |
| `mock-data.json` | 데모 Fixture 계약 |
| `supabase-schema.sql`, `supabase/migrations/`, `supabase/rollbacks/` | 신규 DB bootstrap과 기존 DB의 버전 migration·구조 rollback 계약 |
| `MCM_REBORN_API_GUIDE.md`, `examples/`, `prompts/` | 구현 가이드와 기준 예시 |
| `.env.example` | 저장소의 환경변수 이름과 안전한 기본값 |
| `.gitattributes`, `.gitignore` | 줄바꿈 정규화와 생성물·비밀 환경파일 제외 규칙 |
| `scripts/`, `validate_package.py` | 저장소·계약 검증 도구 |

루트 `examples/`는 참고 구현이다. 앱이 이를 런타임에 직접 참조한다고 가정하지 말고, 실제 적용은 관련 계약을 유지한 채 앱 소유 경로로 구현한다.

## 앱 소유 영역

`mcm-reborn/`은 Next.js `16.3.0`, React `19.2.8` 실행 앱의 루트다. 고객 데모 화면, 실제 브라우저 카메라, v2 API 응답 기반 고객 여정, `/operations` PC 운영 콘솔과 OpenAPI 25개 API operation을 구현하는 23개 v2 Route Handler 파일이 있다. 실제 CUSTOMER/OPERATOR 전체 원격 여정과 OpenAI LIVE 검증은 별도 staging 게이트로 구분한다. 상세 구조는 [`BACKEND_V2_DESIGN.md`](./BACKEND_V2_DESIGN.md)를 따른다.

| 현재 경로 | 책임과 구현 상태 |
|---|---|
| `mcm-reborn/app/` | App Router 페이지·레이아웃과 `app/api/v2/` Route Handler. `/`·`/intro`는 서비스 소개, `/home`은 홈이며 API 디렉터리가 OpenAPI 25개 operation을 구현함 |
| `mcm-reborn/server/` | 인증·HTTP body 제한, 분석·OpenAI·제품·업로드·신청·결제·검수·변경 승인·lifecycle·보증서 서비스, 멱등성과 Supabase RLS/RPC adapter. `server/knowledge/`는 앱에 정적으로 번들되는 서버 전용 위키 스냅샷과 검색기 |
| `mcm-reborn/lib/` | 지연 생성 public/user/admin Supabase server client와 공용 연결 유틸리티 |
| `mcm-reborn/contracts/` | v2 분석·신청·제품·오류 타입과 Zod 검증 계약 |
| `mcm-reborn/components/` | 레이아웃, 공용 UI와 화면별 데모 컴포넌트 |
| `mcm-reborn/data/demo-scenario.ts` | 접수·분석·추천·주문·검수·보증서에 공통으로 쓰는 중앙 Fixture |
| `mcm-reborn/public/assets/` | 저장소에 공개 가능한 데모·카탈로그 자산. 고객이 촬영한 원본의 저장 위치가 아님 |

| 향후 경로·작업 | 도입할 때의 책임 |
|---|---|
| UI의 API client 계층 | 현재 Fixture 고객·운영 콘솔을 `/api/v2` Auth·로딩·빈 상태·오류 처리에 연결 |
| `mcm-reborn/public/assets/products/` | 권리와 파일을 확인한 공개 제품 poster 이미지. 준비 전 `model_3d_ready=false` 유지 |
| `mcm-reborn/public/assets/models/` | 권리와 무결성을 확인한 GLB·glTF 자산. 이미지 파일을 GLB로 가장하지 않음 |
| `mcm-reborn/tests/` | disposable Supabase를 포함한 단위·API 통합·RLS·브라우저 테스트 |

영속 저장을 도입할 때 고객 원본 사진은 `public/`에 넣지 않고 Supabase private bucket에 저장해야 한다. 비밀키, 실제 고객 데이터와 운영 로그도 저장소에 추가하지 않는다.

신규 DB의 전체 bootstrap 기준은 `supabase-schema.sql`이다. 호환되는 기존 v2 데모 DB에는 루트 `supabase/migrations/`의 버전 migration을 순서대로 적용하고, 구조 롤백은 대응하는 `supabase/rollbacks/` 파일과 데이터 안전 조건을 따른다. lifecycle 무결성은 001, 이전 4장·7장 계약은 002·003, v2 런타임은 004, 배송·고객 승인·카피 보정은 005→007로 관리한다. 현행 정면·후면·상단·하단·좌측면·우측면 6장 계약은 `202608210008_capture_six_views.sql`과 대응 rollback으로 관리한다. `origin/feature-backend` v1 DB는 이 migration 체인의 입력으로 지원하지 않는다.

## 지침 적용 순서

저장소 전체 작업에는 루트 `AGENTS.md`가 적용된다. 앱 파일을 다룰 때는 `mcm-reborn/AGENTS.md`의 Next.js 버전 규칙도 함께 적용한다. 두 지침이 충돌하면 더 구체적인 앱 규칙을 따르되 제품 범위·보안·승인 게이트는 루트 규칙을 유지한다.

## 환경 설정

루트 `.env.example`을 환경변수 이름의 단일 기준으로 유지한다. 실제 연동을 개발할 때의 로컬 값은 추적하지 않는 `mcm-reborn/.env.local`에 둔다. 현재 Fixture 중심 브라우저 데모를 실행하는 데 Supabase·OpenAI 비밀값은 필요하지 않다.

```powershell
Copy-Item .\.env.example .\mcm-reborn\.env.local
```

## 검증 명령

저장소 루트에서 계약과 협업 파일을 검증한다.

```bash
python validate_package.py
python -X utf8 scripts/validate_collaboration.py
```

앱 검증도 저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn test
npm --prefix mcm-reborn run build
```

현재 `mcm-reborn/package.json`의 native Node 테스트는 OpenAI 요청·폴백·이미지 범위와 Meshy quota·오류·복구 정책을 검증한다. 외부 LIVE·브라우저·DB 통합 검사는 별도 staging 게이트로 유지한다.
