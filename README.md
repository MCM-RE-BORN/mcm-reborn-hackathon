# MCM RE:BORN 서비스 데모 MVP

이 저장소는 MCM RE:BORN 서비스 흐름을 자연스럽게 시연하기 위한 API 계약 패키지와 `mcm-reborn/` Next.js 애플리케이션을 함께 관리합니다. 저장소 루트에는 API 계약, 구현 가이드, 대표 Mock 시나리오, Supabase 스키마와 OpenAI 분석 예시가 있고, 실제 웹 구현은 `mcm-reborn/`에서 진행합니다.

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
| `openapi.yaml` | OpenAPI 3.1 계약 |
| `mock-data.json` | 최종 제품 4종, 대표 주문·분석·실물 검수·변경 승인·보증서 Fixture |
| `supabase-schema.sql` | 테이블, RLS, Storage 정책, 제품 Seed |
| `.env.example` | 환경변수 템플릿 |
| `prompts/bag-analysis.system.txt` | OpenAI 분석 시스템 프롬프트 |
| `examples/openai-analysis.ts` | Responses API + 이미지 + Zod Structured Output 예시 |
| `examples/mock-status.ts` | v2 상태 전이와 제작 시작 검수·승인 guard 예시 |
| `examples/recommendation.ts` | 결정론적 수율·추천·Mock ESG 계산 |
| `examples/Product3DViewer.tsx` | 모든 제품 상세에서 사용할 3D 뷰어 예시 |
| `examples/model-viewer.d.ts` | React JSX custom element 타입 예시 |
| `validate_package.py` | OpenAPI·Mock·AI 예시·핵심 SQL 보안 불변조건 검증 |
| `mcm-reborn/` | Next.js 16 기반 웹 애플리케이션 스캐폴드와 npm 스크립트 |

## 확정된 UX 계약

- 고객용 웹과 `OPERATOR` 통합 운영 대시보드를 구현합니다.
- 운영자 대시보드는 주문 목록·상세와 주문 후 실물 검수 제출 기능을 제공합니다.
- 분석 모드는 `DEMO_FIXTURE`, `SEEDED_ESTIMATE`, `LIVE` 중 하나이며 모두 같은 예상값 응답 계약을 사용합니다.
- `LIVE` 제공자 오류 시 발표 안정성을 위해 검증된 `DEMO_FIXTURE` 응답으로 폴백할 수 있습니다.
- 사진 품질이 분석 기준에 못 미치면 폴백 성공으로 바꾸지 않고 `422 IMAGE_QUALITY_INSUFFICIENT`와 한국어 재촬영 안내를 반환합니다.
- `authenticityPrecheck`는 사진 기반 주문 가능성 사전 신호이며 공식 정품 판정 또는 보증이 아닙니다.
- 고객 데이터와 private 원본 이미지는 소유자 기반 RLS·Storage 정책으로 격리하고 운영자만 업무상 조회합니다.
- 제품 목록은 각 결과 제품의 완성형 전체 이미지를 표시합니다.
- 여권지갑, 카드지갑, 캐리어 네임택, 키링의 상세 페이지에서 GLB·glTF 3D 뷰어를 제공합니다.
- 결제, 물류, ESG 산식, 보증서는 Mock입니다.
- 결제 성공은 `ORDER_PLACED`이며, 주문 후 전문가 실물 검수와 필요한 고객 변경 승인 전에는 `IN_PRODUCTION`으로 전환할 수 없습니다.

## 빠른 시작 순서

1. 저장소 루트에서 `npm --prefix mcm-reborn ci`를 실행해 기존 Next.js 애플리케이션 의존성을 설치합니다.
2. `supabase-schema.sql`을 실행합니다.
3. Supabase Auth에 고객·운영자 데모 사용자를 생성하고 `profiles`에 역할을 저장합니다.
4. SQL이 생성한 `source-products` private bucket과 Storage 정책을 확인합니다.
5. 보유한 목록 이미지와 GLB·glTF 자산을 `mock-data.json`의 경로에 맞게 배치하거나 URL을 수정합니다.
6. 루트의 `.env.example`을 `mcm-reborn/.env.local`로 복사하고 OpenAI·Supabase 값을 설정합니다.
7. 구현된 운영자 lifecycle command 외의 Route Handler는 `openapi.yaml`을 기준으로 추가합니다.
8. `examples/openai-analysis.ts`와 프롬프트를 AI Provider에 적용합니다.
9. `mock-data.json`의 중앙 시나리오 `MCM_BACKPACK_CHANGE_APPROVED_20260817`와 단일 대표 주문 `RB-20260817-0001`에 연결된 상태 이력·검수·변경안·보증서를 Seed합니다.
10. 대표 주문, 저품질 재촬영, `INELIGIBLE` 사진 보완, AI 장애 폴백, 실물 검수 후 변경 승인 흐름을 각각 리허설합니다.

## 권장 패키지

```bash
npm --prefix mcm-reborn install openai zod @supabase/ssr @supabase/supabase-js @google/model-viewer
```

OpenAPI TypeScript client를 생성할 경우 팀 표준에 맞는 생성기를 하나만 선택합니다. 생성기 없이 타입을 직접 관리하면 `openapi.yaml`, Mock, SQL enum을 같은 변경에서 반드시 동기화합니다.

## 3D 자산 체크

활성 제품 4종 모두 `mcm-reborn/`을 기준으로 아래 파일이 필요합니다.

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

대표 시나리오의 번들 소스 사진은 아래 네 슬롯을 사용합니다. 이 WebP는 앱에 포함된 표시용 Fixture이며, 고객 업로드 계약은 계속 JPG/PNG만 허용합니다.

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
npm --prefix mcm-reborn run build
```

Python 검증에는 PyYAML이 필요합니다. `validate_package.py`는 API 참조·operationId, 업로드 제한, 예상치 메타데이터, 제품 4종, 단일 대표 주문, 실물 검수·변경 승인, SQL enum과 제작 시작 guard의 정합성을 확인합니다. 현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없으므로 테스트를 실행했다고 표시하지 말고, 추가 전까지 이 점을 남은 검증 공백으로 기록합니다.

## 중요 고지

이 패키지의 제품 가격·기간, 재사용 면적, 재활용률, 탄소 절감량, 사진 기반 주문 가능성 신호, 결제, 물류, 보증서는 모두 서비스 시연용 예상치 또는 가상 데이터입니다. `estimateMeta.notice`와 각 화면의 예상치 고지를 통해 실측값·공식 판정·상용 거래처럼 오인되지 않도록 표시해야 합니다.
