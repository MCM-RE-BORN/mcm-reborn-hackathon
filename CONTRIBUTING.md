# MCM RE:BORN 기여 안내

이 저장소의 협업 기준은 [docs/COLLABORATION.md](docs/COLLABORATION.md)입니다. 코딩 에이전트를 사용하는 경우 작업 전에 [AGENTS.md](AGENTS.md)와 [AI_RULES.md](AI_RULES.md)도 반드시 확인합니다.

Next.js 애플리케이션은 `mcm-reborn/`에 있습니다. 앱 작업은 루트 규칙에 더해 [`mcm-reborn/AGENTS.md`](mcm-reborn/AGENTS.md)를 따르며, 현재 `mcm-reborn/app/` 구조를 기준으로 합니다.

기여 흐름은 다음과 같습니다.

1. 이슈에 담당자, 사용자 문제, 완료 조건, 제외 범위, 의존성, 디자인·API 계약을 기록하고 Ready 조건을 충족합니다.
2. 최신 `develop`에서 `feature-*`, `bugfix-*`, `hotfix-*` 중 하나의 브랜치를 만듭니다.
3. 이슈 하나의 범위만 최소 변경으로 구현하고 정상·오류·빈 상태·권한 시나리오를 검증합니다.
4. 변경 범위에 맞는 아래 검증을 저장소 루트에서 실행합니다.
   - API 패키지: `python validate_package.py`
   - 협업 문서·템플릿·스킬: `python -X utf8 scripts/validate_collaboration.py`
   - Next.js 앱: `npm --prefix mcm-reborn ci`, `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`
5. PR 템플릿을 모두 작성하고 AI 사용 내역, 새 의존성, 검증 결과와 롤백 방법을 공개합니다.
6. CI 통과와 본인이 아닌 사람의 승인을 받은 뒤 병합합니다. `main`과 `develop`에는 직접 푸시하지 않습니다.

API 계약을 바꾸는 작업은 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)의 별도 승인 절차를 먼저 따릅니다.

현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없습니다. 테스트를 통과했다고 표시하지 말고 이 검증 공백을 PR에 기록하며, 테스트 스크립트가 추가된 뒤에는 실제 명령과 결과를 남깁니다. 브랜치 생성, 커밋, push, PR 생성과 병합은 명시적으로 요청된 범위에서만 수행합니다.
