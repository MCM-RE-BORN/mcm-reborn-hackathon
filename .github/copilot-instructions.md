# MCM RE:BORN Copilot instructions

작업을 시작하기 전에 `AGENTS.md`, `AI_RULES.md`, `docs/PROJECT_CONTEXT.md`, `docs/COLLABORATION.md`를 읽고 따른다. Copilot CLI가 파일 참조를 지원하는 경우 다음 기준을 함께 불러온다.

@../AGENTS.md
@../AI_RULES.md
@../docs/PROJECT_CONTEXT.md
@../docs/COLLABORATION.md
@../mcm-reborn/AGENTS.md

- `develop`의 2주 해커톤 웹 MVP를 현재 기준으로 삼고 이후 로드맵을 섞지 않는다.
- 최신 `develop`에서 `feature-*`, `bugfix-*`, `hotfix-*` 브랜치를 사용한다.
- 한 이슈당 한 PR, 한 사람당 하나의 `In Progress` 작업을 유지한다.
- 완료 기준과 제외 범위를 먼저 확인하고 관련 없는 파일을 수정하지 않는다.
- 승인 없이 패키지·프레임워크를 추가하거나 API·DB·Mock 계약을 변경하지 않는다.
- 비밀값과 실제 사용자 데이터를 코드, 문서, Fixture, 로그에 넣지 않는다.
- 정상·오류·빈 상태·권한 경계를 검토하고 관련 lint, 타입 검사, 테스트, 빌드를 실행한다.
- 실행하지 않은 검사를 통과했다고 쓰거나 테스트를 삭제·약화하지 않는다.
- `main`과 `develop`에 직접 push하지 않는다. 작성자는 자신의 PR을 승인하지 않으며, 사람의 승인과 CI 통과 뒤 팀의 병합 권한 정책을 따른다.
- PR에 AI 사용 도구와 범위, 사람이 검토한 항목, 미확인 위험을 공개한다.
- 문서와 구현이 충돌하거나 MVP 범위·계약에 영향을 주는 선택이 필요하면 변경 전에 사용자 승인을 받는다.
- 계약·Mock·DB 기준은 저장소 루트에 있고 Next.js 앱은 `mcm-reborn/`에 있다. 앱 작업에는 루트 규칙과 `mcm-reborn/AGENTS.md`를 함께 적용하며 현재 `mcm-reborn/app/` 구조를 승인 없이 광범위하게 옮기지 않는다.
- 앱 변경은 저장소 루트에서 `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`로 검증한다. 의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다.
- 현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없다. 테스트를 통과했다고 쓰지 말고 검증 공백을 공개한다.
- 브랜치 생성, 커밋, push, PR 생성과 병합은 사용자나 연결된 이슈가 명시적으로 요청한 범위에서만 수행한다.

`.agents/skills/` 형식을 지원하는 에이전트는 일반 이슈에 `$mcm-work-on-issue`, 계약 변경에 `$mcm-change-api-contract`, 완료 및 PR 준비에 `$mcm-prepare-pull-request`를 사용한다. 이 형식을 지원하지 않으면 각 스킬의 같은 이름 `SKILL.md`를 절차서로 따른다.
