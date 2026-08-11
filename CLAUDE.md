# MCM RE:BORN Claude instructions

이 파일은 루트 규칙을 대체하지 않는 진입점이다. 작업 전에 아래 지침을 읽고 모두 따른다.

@AGENTS.md
@AI_RULES.md
@docs/PROJECT_CONTEXT.md
@docs/COLLABORATION.md

- API 계약과 협업 문서는 저장소 루트에 있고, Next.js 애플리케이션은 `mcm-reborn/`에 있다.
- `mcm-reborn/`를 작업하면 `mcm-reborn/AGENTS.md`와 `mcm-reborn/CLAUDE.md`도 읽는다. 중첩 파일은 루트의 범위·승인·보안·Git 규칙을 보완할 뿐 대체하지 않는다.
- 앱 검증은 저장소 루트에서 `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`로 실행한다. 의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다.
- 현재 자동 테스트 스크립트는 없다. 테스트를 실행하거나 통과했다고 표현하지 말고 검증 공백을 기록한다.
- `main`과 `develop`에 직접 push하지 않는다. 브랜치 생성, 커밋, push, PR 생성과 병합은 명시적으로 요청된 범위에서만 수행한다. 작성자는 자신의 PR을 승인하지 않으며 병합은 사람의 승인과 필수 검사 뒤 팀 권한 정책을 따른다.
