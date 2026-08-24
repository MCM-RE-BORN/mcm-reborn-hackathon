# MCM RE:BORN 서비스 데모 MVP

이 저장소는 MCM RE:BORN 서비스 흐름을 자연스럽게 시연하기 위한 API 계약 패키지와 `mcm-reborn/` Next.js 애플리케이션을 함께 관리합니다. 저장소 루트에는 API 계약, 대표 Mock 시나리오, Supabase 스키마·migration과 OpenAI 분석 예시가 있고, 앱에는 Fixture UI와 OpenAPI 25개 API operation을 구현하는 23개 v2 Route Handler 파일이 있습니다. UI는 아직 API에 연결되지 않았으며 실제 Supabase/OpenAI 런타임도 검증되지 않았습니다.

최신 제품 의미와 시연 순서는 `docs/MVP_DEMO_CANONICAL.md`, 기계 판독 API 계약은 `openapi.yaml` v2.0.0을 기준으로 합니다. AI가 안정적으로 판단하기 어려운 값은 예상치 또는 데모 데이터로 제시하고, 주문·결제·수거 후 전문가 실물 검수와 고객 변경 승인을 거쳐 제작합니다.

## 협업 시작

사람과 코딩 에이전트 모두 작업 전에 아래 순서로 기준을 확인합니다.

1. [`AGENTS.md`](AGENTS.md) — 저장소 전체 작업 규칙과 필수 문서
2. [`AI_RULES.md`](AI_RULES.md) — AI 작업 범위, 금지 사항, 검증과 공개 규칙
3. [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — 서비스 데모 MVP의 현재 기준과 범위
4. [`docs/COLLABORATION.md`](docs/COLLABORATION.md) — 이슈, 브랜치, PR, 리뷰, QA 운영 규칙
5. [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) — 루트 계약과 Next.js 앱의 경로·소유권
6. [`mcm-reborn/AGENTS.md`](mcm-reborn/AGENTS.md) — Next.js 애플리케이션 작업 시 추가로 적용되는 규칙

기여 절차는 [`CONTRIBUTING.md`](CONTRIBUTING.md)를 따릅니다. 제품 범위·사용자 흐름·계약·시연·의사결정은 각각 [`docs/PRD.md`](docs/PRD.md), [`docs/USER_FLOW.md`](docs/USER_FLOW.md), [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md), [`docs/DEMO.md`](docs/DEMO.md), [`docs/DECISIONS.md`](docs/DECISIONS.md)에서 관리합니다. 저장소 전용 에이전트 스킬은 [`.agents/skills/`](.agents/skills/)에 있습니다.

## 포함 파일

| 파일 | 용도 |
|---|---|
| `MCM_REBORN_API_GUIDE.md` | v2 아키텍처, API 사용법, 예상치 규칙, 주문 상태 모델 |
| `docs/BACKEND_V2_DESIGN.md` | 완성된 v2 구조, 25개 operation, 보안·DB·외부 연동 경계 요약 |
| `openapi.yaml` | OpenAPI 3.1 계약 |
| `mock-data.json` | 최종 제품 4종, 대표 주문·분석·실물 검수·변경 승인·보증서 Fixture |
| `supabase-schema.sql` | 테이블, RLS, Storage 정책, 제품 Seed |
| `.env.example` | 환경변수 템플릿 |
| `prompts/bag-analysis.system.txt` | OpenAI 분석 developer prompt 참고본 |
| `docs/AI_ANALYSIS_DOMAIN_KNOWLEDGE.md` | PDF에서 정규화한 소재·구성 부위·재사용 판단 지식과 감사 버전 |
| `examples/openai-analysis.ts` | Responses API + 이미지 + Zod Structured Output 참고 예시. 실행 Route Handler는 공식 SDK의 Chat Completions Structured Outputs 사용 |
| `examples/mock-status.ts` | v2 상태 전이와 제작 시작 검수·승인 guard 예시 |
| `examples/recommendation.ts` | 결정론적 수율·추천·Mock ESG 계산 |
| `examples/Product3DViewer.tsx` | 실제 GLB 자산이 준비된 뒤 사용할 수 있는 3D 뷰어 참고 예시 |
| `examples/model-viewer.d.ts` | React JSX custom element 타입 예시 |
| `validate_package.py` | OpenAPI·Mock·AI 예시·핵심 SQL 보안 불변조건 검증 |
| `demo-images/` | AI 분석 접수 시 슬롯별로 업로드하는 시연용 백팩 6면 JPEG |
| `mcm-reborn/` | Next.js 16 웹 앱, Fixture 고객·운영 UI, v2 Route Handler·서비스와 npm 스크립트 |

## 확정된 UX 계약

- 고객용 웹과 `OPERATOR` 경계의 최소 PC 운영 콘솔을 구현합니다.
- `/operations` 콘솔은 중앙 Fixture 신청 목록·상세와 단계별 관리자·장인 담당 표시, 다음 단계 진행을 제공합니다. 실제 영속 쓰기는 현행 v2 lifecycle command에 연결한 뒤 활성화합니다.
- 분석 모드는 `DEMO_FIXTURE`, `SEEDED_ESTIMATE`, `LIVE` 중 하나이며 모두 같은 예상값 응답 계약을 사용합니다.
- `LIVE`는 배포 opt-in, privacy notice와 요청별 외부 처리 동의를 요구합니다. 공식 OpenAI JavaScript SDK의 Chat Completions Structured Outputs를 사용합니다. 일시적 429는 `Retry-After`를 지키며 한 번만 재시도하고, quota·billing 한도는 재시도하지 않습니다. 최종 실패에는 검증된 `DEMO_FIXTURE` 응답으로 복구하되 결과 화면에 작게 `API오류로 인한 DEMO`를 표시합니다.
- 사진 품질이 분석 기준에 못 미치면 폴백 성공으로 바꾸지 않고 `422 IMAGE_QUALITY_INSUFFICIENT`와 한국어 재촬영 안내를 반환합니다.
- `authenticityPrecheck`는 사진 기반 주문 가능성 사전 신호이며 공식 정품 판정 또는 보증이 아닙니다.
- 고객 데이터와 private 원본 이미지는 소유자 기반 RLS·Storage 정책으로 격리하고 운영자만 업무상 조회합니다.
- 제품 목록은 각 결과 제품의 완성형 전체 이미지를 표시합니다.
- 현재 제품 상세는 정적 다각도 목업을 제공합니다. Product3D JSON은 DB와 canonical Mock에 보존하지만 실제 GLB/poster가 준비되기 전에는 `model_3d_ready`/`model3dReady=false`이며 API는 `has3d=false`, `model3d=null`로 응답합니다.
- 신규 `3D 목업` 생성(`TARGET_RETEXTURE`)의 앱 일일 한도는 기본적으로 비활성입니다. 필요하면 `MESHY_TARGET_RETEXTURE_DAILY_LIMIT_PER_USER`와 `MESHY_TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT`에 각각 `1`~`100`을 설정해 UTC 일일 안전 한도를 켤 수 있으며 빈값 또는 `0`은 비활성입니다. Meshy의 실제 크레딧·요청 제한은 provider의 `402`·`429` 응답을 기준으로 처리하고, 완료·진행 중인 동일 작업과 복구 영수증을 재사용해 중복 생성·과금을 막습니다.
- 결제, 물류, ESG 산식, 보증서는 Mock입니다.
- 결제 성공은 `ORDER_PLACED`이며, 주문 후 전문가 실물 검수와 필요한 고객 변경 승인 전에는 `IN_PRODUCTION`으로 전환할 수 없습니다.

## 빠른 시작 순서

1. 저장소 루트에서 `npm --prefix mcm-reborn ci`를 실행해 기존 Next.js 애플리케이션 의존성을 설치합니다.
2. 신규·빈 v2 staging이면 `supabase-schema.sql`만 실행합니다. 호환되는 기존 v2 데모 DB이면 migration 001→007을 적용합니다. 005는 배송 시작 RPC의 모호한 충돌 대상을, 006은 고객 결정 전 제작 진행 우회를, 007은 특정 원제품 패턴을 전제한 상품 문구를 수정합니다.
3. Supabase Auth에 고객·운영자 데모 사용자를 생성하고 `profiles`에 역할을 저장합니다.
4. SQL이 생성한 `source-products` private bucket과 Storage 정책을 확인합니다.
5. 현재 정적 제품 이미지를 확인합니다. 향후 권리와 파일 무결성을 확인한 GLB·poster를 추가할 때만 Product3D readiness를 활성화합니다.
6. 루트의 `.env.example`을 `mcm-reborn/.env.local`로 복사하고 Supabase 값을 설정합니다. OpenAI 값은 외부 AI 동의 체계를 갖춘 `LIVE` 시험에서만 설정합니다.
7. `/operations`와 고객 화면을 live 데이터에 연결할 때는 제거된 `/api/v1`이 아니라 구현된 `/api/v2`와 `openapi.yaml`을 사용합니다.
8. `LIVE`를 시험할 때는 외부 AI opt-in·privacy notice·요청별 동의·증적 저장을 먼저 구성하고, 기본 데모는 `DEMO_FIXTURE`로 유지합니다.
9. `mock-data.json`의 중앙 시나리오 `MCM_BACKPACK_CHANGE_APPROVED_20260817`와 단일 대표 주문 `RB-20260817-0001`에 연결된 상태 이력·검수·변경안·보증서를 Seed합니다.
10. 대표 주문, 저품질 재촬영, `INELIGIBLE` 사진 보완, AI 장애 폴백, 실물 검수 후 변경 승인 흐름을 각각 리허설합니다.

## AI 분석 접수용 시연 이미지

카메라 촬영 대신 저장소의 [`demo-images/`](demo-images/) 폴더에 있는 사진 6장을 사용해 AI 분석 접수 흐름을 시연할 수 있습니다. 제품 사진 등록 화면에서 각 슬롯에 다음 파일을 한 장씩 등록합니다.

| 등록 슬롯 | 사용할 파일 |
|---|---|
| 정면 | [`정면.jpeg`](demo-images/정면.jpeg) |
| 후면 | [`후면.jpeg`](demo-images/후면.jpeg) |
| 상단 | [`상단.jpeg`](demo-images/상단.jpeg) |
| 하단 | [`하단.jpeg`](demo-images/하단.jpeg) |
| 좌측면 | [`좌측면.jpeg`](demo-images/좌측면.jpeg) |
| 우측면 | [`우측면.jpeg`](demo-images/우측면.jpeg) |

사진 6장과 필수 제품 정보, 영문과 숫자를 조합한 11자리 시리얼 번호를 입력한 뒤 `AI 분석 접수하기`를 누릅니다. 시리얼 번호 사진은 선택 사항이므로 이 폴더에는 포함하지 않았습니다. 이 사진은 서비스 시연용 입력 자료로만 사용합니다.

## 의존성

Node.js 22.18.0 이상을 사용하고 새 패키지를 개별 설치하지 말고 lockfile 기준으로 `npm --prefix mcm-reborn ci`를 실행합니다. native 테스트는 Node의 TypeScript type stripping을 사용합니다. 현재 정적 목업에는 `@google/model-viewer`를 사용하지 않습니다. 향후 OpenAPI TypeScript client나 3D 런타임을 추가하려면 별도 승인과 계약·자산 검증이 필요합니다.

## 3D 자산 체크

아래 GLB·poster 경로는 Product3D를 실제 활성화할 때 필요한 목표 경로입니다. 현재 파일은 준비되지 않았으며 API는 `model_3d_ready=false` 제품에 `model3d`를 노출하지 않습니다.

```text
public/assets/mvp-beta/recommendation-passport-wallet.png
public/assets/products/passport-wallet/poster.webp
public/assets/models/passport-wallet.glb

public/assets/mvp-beta/recommendation-card-holder.png
public/assets/products/card-wallet/poster.webp
public/assets/models/card-wallet.glb

public/assets/mvp-beta/recommendation-luggage-name-tag-v2.webp
public/assets/products/name-tag/poster.webp
public/assets/models/name-tag.glb

public/assets/mvp-beta/recommendation-keyring-v2.webp
public/assets/products/keyring/poster.webp
public/assets/models/keyring.glb
```

대표 시나리오의 아래 네 WebP는 여러 화면에서 재사용하는 표시용 Fixture일 뿐 분석 업로드를 대신하지 않습니다. 고객 분석 계약은 정면·후면·상단·하단·좌측면·우측면 JPG/PNG 6장을 모두 요구합니다. 일련번호 사진은 선택 사항이며 분석 `imageAssetIds`에 포함하지 않습니다.

```text
public/assets/mvp-beta/source-backpack-front.webp
public/assets/mvp-beta/source-backpack-side.webp
public/assets/mvp-beta/source-backpack-interior.webp
public/assets/mvp-beta/source-backpack-engraving.webp
```

보유 자산의 실제 파일명이 다르면 DB Seed와 `mock-data.json`을 함께 변경합니다.

## 공식 참고 문서

- OpenAI Images and vision: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured model outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI rate limits: https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI API request IDs and rate-limit headers: https://developers.openai.com/api/reference/overview
- OpenAI API key safety: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- OpenAI project keys: https://help.openai.com/en/articles/5008148-can-i-share-my-api-key-with-my-teammatecoworker
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js route file convention: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase private buckets and signed URLs: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed uploads: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- model-viewer docs: https://modelviewer.dev/docs/
- model-viewer materials and variants: https://modelviewer.dev/examples/scenegraph/
- Spring Boot Servlet Web Applications: https://docs.spring.io/spring-boot/reference/web/servlet.html

## 설치와 검증

저장소 루트에서 다음 명령을 실행합니다.

```bash
npm --prefix mcm-reborn ci
python -X utf8 scripts/validate_collaboration.py
python -X utf8 validate_package.py
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run test:analysis-fallback
npm --prefix mcm-reborn run test:openai-images
npm --prefix mcm-reborn run test:openai-policy
npm --prefix mcm-reborn run test:provider-fallback
npm --prefix mcm-reborn run test:texture-policy
npm --prefix mcm-reborn run build
```

Python 검증에는 PyYAML이 필요합니다. `validate_package.py`는 API 참조·operationId, 업로드 제한, 예상치 메타데이터, 제품 4종, 단일 대표 주문, 실물 검수·변경 승인, SQL enum과 제작 시작 guard의 정합성을 확인합니다. native Node 테스트는 LIVE OpenAI 요청 정책, 위키 lookup 4면·최종 분석 6면 이미지 계약, canonical 제공자 폴백·API 오류 DEMO 표기와 Meshy 한도·오류·복구 정책을 검증합니다.

## 중요 고지

이 패키지의 제품 가격·기간, 재사용 면적, 재활용률, 탄소 절감량, 사진 기반 주문 가능성 신호, 결제, 물류, 보증서는 모두 서비스 시연용 예상치 또는 가상 데이터입니다. `estimateMeta.notice`와 각 화면의 예상치 고지를 통해 실측값·공식 판정·상용 거래처럼 오인되지 않도록 표시해야 합니다.
