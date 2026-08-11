# 프로젝트 컨텍스트

## 현재 기준

MCM RE:BORN은 사용자가 보유한 MCM 가방 이미지를 분석하고 업사이클링 제품을 추천한 뒤 신청·진행·ESG 보증서를 시연하는 웹 MVP다. 현재 제품 기준은 `develop` 브랜치의 2주 해커톤 범위이며, HTTP 계약 버전은 OpenAPI `1.1.0`이다.

로컬 기획 문서의 확장 기능은 Phase 2 로드맵이다. 로드맵 요구를 MVP에 적용해야 할 가능성이 보이면 에이전트가 임의로 포함하지 않고 차이와 영향을 먼저 보고해 승인을 받는다.

## MVP 역할과 채널

| 구분 | MVP 역할 |
|---|---|
| `CUSTOMER` | 이미지 업로드, AI 분석, 제품 추천·3D 확인, 신청·Mock 결제, 진행·배송·보증서 조회 |
| `OPERATOR` | 관리자와 장인 업무를 합친 최소 대시보드에서 신청 목록·상세 조회와 승인 |
| 채널 | 웹만 지원 |

## MVP 시스템 경계

- 분석은 OpenAI 호출을 사용하며 `AI_MODE`에 따라 live, fixture, hybrid로 실행한다.
- hybrid의 제공자 실패 폴백과 준비된 Fixture는 데모 안정성을 위한 기능이다.
- 사진 품질이 분석 기준에 못 미치면 폴백 성공으로 바꾸지 않는다. `POST /analyses`는 `422 IMAGE_QUALITY_INSUFFICIENT`와 이미지별 재촬영 안내를 반환하며 성공 분석을 생성하지 않는다.
- 분석의 `authenticitySignal = REVIEW_REQUIRED`는 정품·가품 판정이 아닌 수동 검토 신호다. 분석 저장 시 `PENDING` 수동 검토 건을 만들고, 이 분석으로 신청하면 신청 레코드 없이 `422 AUTHENTICITY_REVIEW_REQUIRED`를 반환한다.
- 수동 검토를 완료하거나 신청 차단을 해제하는 API·운영 UI는 2주 MVP에 포함하지 않는다.
- 결제, 물류, ESG 산식과 보증서는 데모용 Mock이며 실제 상거래·법적 증빙이 아니다.
- 결과 카탈로그는 파우치, 카드 지갑, 키링 3종과 각 제품의 완성 이미지·3D 자산을 전제로 한다.
- 인증과 데이터 접근은 Supabase Auth·RLS 경계를 유지한다.
- 저장소 루트에는 OpenAPI·Mock·DB·구현 예시가 있고, 실제 웹 앱 루트는 `mcm-reborn/`이다.
- `mcm-reborn/`에는 Next.js 기본 scaffold만 존재한다. 위 MVP 동작이 구현 완료되었다고 간주하지 않는다.

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
| MVP 목표·범위 | `docs/PROJECT_CONTEXT.md`, `docs/PRD.md` |
| 사용자 흐름 | `docs/USER_FLOW.md` |
| HTTP API | `openapi.yaml` |
| 구현 설명·상태 모델 | `MCM_REBORN_API_GUIDE.md` |
| 데모 Fixture | `mock-data.json` |
| DB·RLS | `supabase-schema.sql` |
| 앱 기술·명령 | `mcm-reborn/package.json`, `mcm-reborn/package-lock.json` |
| Next.js 버전 규칙 | `mcm-reborn/AGENTS.md`, 설치된 `mcm-reborn/node_modules/next/dist/docs/` |
| 결정 이력 | `docs/DECISIONS.md` |

HTTP 필드·상태 코드에는 `openapi.yaml`이 우선하지만, 다른 파일과 충돌한다고 해서 자동으로 덮어쓰지는 않는다. 소비자 영향과 선택지를 보고하고 계약 변경 절차를 따른다.

## Phase 2 로드맵

다음은 별도 승인 없이는 MVP에 포함하지 않는다.

- 고객, 장인, 브랜드 관리자를 분리한 다중 역할 제품
- 실제 정품 판정 서비스와 가품 처리 정책
- 실물 입고·2차 검수, 최종 조건 제시와 고객 재승인
- 장인 배정, 제작 기록, 지연 관리, 생산 용량 제어
- 최종 QC 확장, A/S 문의와 불변 감사 로그
- iOS 앱과 장기 KPI·탄소 회계 운영 체계

Phase 2 제안이 MVP 버그나 필수 안전 요구를 해결한다면 연결 이슈에서 MVP 적용 여부를 사람이 결정하고 `docs/DECISIONS.md`에 기록한다.
