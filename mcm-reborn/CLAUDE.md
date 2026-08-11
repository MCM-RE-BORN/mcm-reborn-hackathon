@../AGENTS.md
@../AI_RULES.md
@AGENTS.md

# MCM RE:BORN Next.js bridge

이 앱의 지침은 루트 규칙을 보완하며 대체하지 않는다. 현재 소스는 `mcm-reborn/app/`, 공개 자산은 `mcm-reborn/public/`에 있고 API·Mock·DB 계약은 저장소 루트에 있다.

저장소 루트에서 `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`를 실행한다. 의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다. 현재 자동 테스트 스크립트가 없으므로 테스트 통과를 주장하지 않는다.

`main`과 `develop`에 직접 push하지 않는다. 브랜치 생성, 커밋, push, PR 생성과 병합은 명시적으로 요청된 범위에서만 수행하고, 사람의 승인과 필수 검사가 끝나기 전에 병합하지 않는다.
