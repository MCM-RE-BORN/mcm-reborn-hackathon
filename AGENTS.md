# MCM RE:BORN agent instructions

이 저장소에서 작업하는 모든 코딩 에이전트는 작업을 시작하기 전에 이 파일과 아래 문서를 읽고 따라야 한다.

1. `AI_RULES.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/COLLABORATION.md`
4. 작업과 관련된 계약 문서
   - 저장소 구조: `docs/REPOSITORY_STRUCTURE.md`
   - 제품 범위: `docs/PRD.md`, `docs/USER_FLOW.md`
   - API·DB·Mock: `docs/API_CONTRACT.md`, `openapi.yaml`
   - 시연: `docs/DEMO.md`
   - 기존 결정: `docs/DECISIONS.md`

문서와 코드 또는 계약이 충돌하면 임의로 하나를 선택하지 말고 충돌 지점과 영향을 사용자에게 보고한 뒤 승인을 받는다. `develop`의 2주 해커톤 MVP를 현재 기준으로 삼고, 이후 로드맵은 MVP에 섞지 않는다.

## 저장소 구조와 지침 상속

- 저장소 루트는 `openapi.yaml`, `mock-data.json`, `supabase-schema.sql`, API 가이드와 협업 문서를 관리한다.
- 실제 Next.js 애플리케이션 루트는 `mcm-reborn/`이다. 현재 코드는 `mcm-reborn/app/` App Router 구조이며 공개 자산은 `mcm-reborn/public/`에 둔다.
- `mcm-reborn/` 파일을 작업할 때도 이 루트 지침을 먼저 적용하고 `mcm-reborn/AGENTS.md`의 Next.js 전용 지침을 추가로 따른다. 중첩 지침은 루트의 범위·승인·보안·Git 규칙을 대체하지 않는다.
- Next.js API와 관례를 기억으로 추측하지 않는다. 설치된 버전과 `mcm-reborn/node_modules/next/dist/docs/`의 관련 문서를 확인하고, 현재 `app/` 구조를 `src/app/`으로 옮기는 광범위한 정리는 별도 승인 없이는 하지 않는다.

## 작업 시작 게이트

- 연결된 이슈, 담당자, 사용자 문제, 완료 기준, 제외 범위, 의존성을 확인한다.
- UI 작업이면 화면 상태와 디자인 기준을, API 작업이면 요청·응답·오류 계약을 확인한다.
- 중요한 제품 결정이나 계약 승인이 없으면 구현을 멈추고 질문한다.
- 하루를 넘길 작업은 독립적으로 검증 가능한 작은 이슈로 나눈다.
- 한 작업자는 동시에 하나의 `In Progress` 이슈만 다룬다.

## 구현 규칙

- 최신 `develop`에서 `feature-*`, `bugfix-*`, `hotfix-*` 중 맞는 브랜치를 만든다.
- 한 이슈를 한 PR로 만들고 관련 없는 파일을 수정하지 않는다.
- 기존 구조, 타입, 패턴을 우선 재사용한다.
- 승인 없이 새 프레임워크·패키지를 도입하거나 API·DB 계약을 바꾸지 않는다.
- 비밀값, 개인 정보, 운영 인증정보를 코드·문서·로그·Fixture에 넣지 않는다.
- 테스트를 삭제하거나 약화해 통과시키지 않는다.
- 전체 프로젝트 재작성이나 광범위한 정리는 별도 승인 없이는 하지 않는다.

## 계약 변경

`openapi.yaml`, 요청·응답·오류 형식, 상태값, `mock-data.json`, `supabase-schema.sql`의 호환성에 영향을 주는 변경은 계약 변경으로 취급한다. 별도 이슈와 프론트엔드·백엔드 양쪽 승인을 확인하고 다음 순서로 동기화한다.

1. 계약과 예시
2. Mock 및 타입
3. 서버와 DB
4. 클라이언트
5. 통합 테스트와 문서

## 검증과 완료

- 정상, 오류, 빈 상태, 권한 시나리오를 검토한다.
- 변경 범위에 맞는 lint, 타입 검사, 테스트, 빌드를 실행한다.
- Next.js 의존성을 재현해야 하면 저장소 루트에서 `npm --prefix mcm-reborn ci`를 실행한다.
- `mcm-reborn/` 변경에는 저장소 루트에서 `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`를 실행한다.
- 현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없다. 테스트를 실행하거나 통과했다고 표현하지 말고 이 공백을 결과와 PR에 기록한다. 테스트 스크립트가 추가되면 그때 실제 명령을 실행한다.
- API 패키지를 바꾸면 `python validate_package.py`를, 협업 문서·템플릿·스킬을 바꾸면 `python -X utf8 scripts/validate_collaboration.py`를 실행한다.
- 실행하지 못한 검사는 통과했다고 표현하지 말고 이유와 위험을 남긴다.
- 문서, 데모 데이터, 롤백 방법이 영향받으면 함께 갱신한다.
- 커밋은 `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore` 중 맞는 유형을 사용한다.
- `main`과 `develop`에 직접 push하지 않는다. 작성자는 자신의 PR을 승인하지 않으며, 사람의 승인과 필수 검사가 끝난 뒤 팀의 병합 권한 정책을 따른다.
- PR에 AI 사용 도구, 사용 범위, 사람이 직접 확인한 항목을 공개한다.
- 브랜치 생성, 커밋, push, PR 생성과 병합은 사용자나 연결된 이슈가 명시적으로 요청한 범위에서만 수행한다.

## 저장소 스킬

관련 작업에서는 `.agents/skills/`의 스킬을 사용한다.

- 일반 이슈 계획·구현: `$mcm-work-on-issue`
- API·DB·Mock 계약 변경: `$mcm-change-api-contract`
- 커밋·PR 준비와 완료 점검: `$mcm-prepare-pull-request`
