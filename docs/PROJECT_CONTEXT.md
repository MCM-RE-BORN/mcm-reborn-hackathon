# 프로젝트 컨텍스트

## 현재 기준

- 기계 판독 API 계약은 `openapi.yaml`의 **OpenAPI 2.0.0** 제품 계약을 사용한다.

MCM RE:BORN은 사용자가 보유한 MCM 가방을 모바일로 촬영하고, 사진 기반 AI 예상 분석·디자인 추천·목업·주문·수거 후 실물 검수·제작 진행·ESG 보증서를 하나의 웹 흐름으로 시연하는 데모 MVP다.

2026-08-17 현재 제품 기준은 [`MVP_DEMO_CANONICAL.md`](./MVP_DEMO_CANONICAL.md)다. 이 MVP는 실제 AI·결제·물류를 완성하는 것보다 최종 기획 흐름을 자연스럽고 재현 가능하게 시연하는 데 우선순위를 둔다. AI가 안정적으로 판단하기 어려운 값은 중앙 Fixture 또는 재현 가능한 예상치로 제공할 수 있다.

이전의 “기존 계약을 우선하고 실물 검수·조건 재승인을 Phase 2로 둔다”는 설명은 **2026-08-17 기준 superseded/historical**이다. 현재 데모는 AI 사전 판단으로 Mock 주문을 만든 뒤, 수거된 실물을 공식 장인이 마지막으로 점검하고 변경 조건을 고객이 승인하는 흐름을 포함한다.

## MVP 역할과 채널

| 구분 | MVP 역할 |
|---|---|
| `CUSTOMER` | 촬영·업로드, 사진 기반 AI 예상 분석, 추천·목업 확인, Mock 주문·결제, 변경 조건 승인, 진행·보증서 조회 |
| `OPERATOR` | 데모 데이터와 주문 상태를 조회하는 보조 역할. 주문 전 장인 승인 게이트는 수행하지 않음 |
| 공식 장인 검수 | 독립 계정이 아닌 Mock 공정. 주문·수거 후 `EXPERT_INSPECTION`에서 실물 조건을 점검 |
| 채널 | 웹만 지원 |

## MVP 시스템 경계

- 분석은 live, fixture, hybrid/fixture-fallback 방식으로 실행할 수 있다. 골든 데모는 중앙 시나리오의 고정·시드 기반 예상치를 사용한다.
- 중앙 시나리오는 원제품 `MCM 비세토스 모노그램 백팩(2019, 5년 이상)`, 희망 제품 `RE:BORN 여권지갑`, 접수 `SUB-RB-20260817-0001`, 주문 `RB-20260817-0001`을 사용한다.
- AI 사전 분석은 예상 재활용률 72%, 정품 사전 적합도 예상 91%를 표시한다. 91%는 주문 적합 신호이며 정품 확정이 아니다.
- 사진 품질이 분석 기준에 못 미치면 폴백 성공으로 바꾸지 않는다. `POST /analyses`는 `422 IMAGE_QUALITY_INSUFFICIENT`와 이미지별 재촬영 안내를 반환하며 성공 분석을 생성하지 않는다.
- AI 사전 적합성 신호는 공식 정품 판정이 아니다. 명백한 비대상은 주문 전에 안내할 수 있지만 골든 경로는 AI 신호로 주문·Mock 결제까지 진행한다.
- 공식 장인 실물 검수는 `ORDER_PLACED → PICKUP → PRODUCT_RECEIVED` 이후에만 수행한다. 골든 경로는 `CHANGE_REQUIRED`이며 68%, 195,000원, 4~5주 변경안을 고객이 승인한다.
- 결제, 물류, ESG 산식과 보증서는 데모용 Mock이며 실제 상거래·법적 증빙이 아니다.
- 핵심 추천·주문·보증서 시나리오는 `RE:BORN 여권지갑`으로 통일한다. 다른 후보는 비교용 Fixture로 표시할 수 있다.
- 인증과 데이터 접근은 Supabase Auth·RLS 경계를 유지한다.
- 저장소 루트에는 OpenAPI·Mock·DB·구현 예시가 있고, 실제 웹 앱 루트는 `mcm-reborn/`이다.
- 앱 구현 상태는 코드와 검증 결과로 판단한다. 과거 문서의 “Next.js 기본 scaffold만 존재” 설명은 historical이다.

## 기술 경계

- 기준 구현은 `mcm-reborn/`의 Next.js `16.3.0`, React `19.2.8`, TypeScript strict 구성과 Supabase Auth·Postgres·Storage 조합이다.
- 앱은 ESLint `9`, Tailwind CSS `4`를 사용한다. 패키지와 프레임워크 버전은 `mcm-reborn/package.json`과 lockfile을 확인한다.
- AI 분석은 OpenAI Responses API의 구조화 출력과 서버 전용 키를 사용한다.
- 입력·AI 응답 검증에는 기존 가이드의 Zod 패턴을, 3D 표시에는 `@google/model-viewer`를 우선한다.
- Spring Boot 구성은 API 가이드의 대안일 뿐이며 같은 MVP에서 두 서버 구조를 혼합하지 않는다.
- 앱 작업 전 `mcm-reborn/AGENTS.md`의 Next.js 버전별 규칙을 읽고 설치된 `node_modules/next/dist/docs/`에서 해당 API를 확인한다.
- 승인 없이 프레임워크나 유사 패키지를 새로 선택하지 않는다.

## 기준 파일

| 판단 대상 | 기준 |
|---|---|
| 협업과 에이전트 행동 | `AGENTS.md`, `AI_RULES.md`, `docs/COLLABORATION.md` |
| 저장소 경로·소유권 | `docs/REPOSITORY_STRUCTURE.md` |
| MVP 제품·데모 최종 기준 | `docs/MVP_DEMO_CANONICAL.md` |
| MVP 목표·범위 | `docs/PROJECT_CONTEXT.md`, `docs/PRD.md` |
| 사용자 흐름 | `docs/USER_FLOW.md` |
| HTTP API | `openapi.yaml` |
| 구현 설명·상태 모델 | `MCM_REBORN_API_GUIDE.md` |
| 데모 Fixture | `mock-data.json` |
| DB·RLS | `supabase-schema.sql` |
| 앱 기술·명령 | `mcm-reborn/package.json`, `mcm-reborn/package-lock.json` |
| Next.js 버전 규칙 | `mcm-reborn/AGENTS.md`, 설치된 `mcm-reborn/node_modules/next/dist/docs/` |
| 결정 이력 | `docs/DECISIONS.md` |

HTTP 필드·상태 코드의 기계 판독 기준은 `openapi.yaml`이다. 제품 의미와 흐름은 `MVP_DEMO_CANONICAL.md`를 구현해야 하며, 둘이 다르면 조용히 우회하지 않고 같은 변경 단위에서 OpenAPI·Mock·DB·앱·문서를 정합화한다.

## Phase 2 로드맵

다음은 별도 승인 없이는 MVP에 포함하지 않는다.

- 고객, 장인, 브랜드 관리자를 분리한 다중 역할 제품
- 실제 정품 판정 서비스와 가품 처리 정책
- 실제 장인 배정·실물 검수 시스템과 외부 운영 콘솔
- 실제 결제 취소·환불, 제작 기록, 지연 관리, 생산 용량 제어
- 최종 QC 확장, A/S 문의와 불변 감사 로그
- iOS 앱과 장기 KPI·탄소 회계 운영 체계

MVP에는 수거 후 실물 검수, 변경 조건 승인, 제작·품질·배송 상태를 **Mock/Fixture 흐름**으로 포함한다. 외부 서비스와 실제 운영 기능으로 확장할 때만 Phase 2 이슈로 다루고 `docs/DECISIONS.md`에 기록한다.
