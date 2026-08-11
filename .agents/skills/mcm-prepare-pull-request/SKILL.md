---
name: mcm-prepare-pull-request
description: MCM RE:BORN 루트 API 패키지나 `mcm-reborn/` Next.js 앱 변경을 완료·검토하고 커밋, 푸시 또는 Pull Request 준비 상태를 확인할 때 사용한다. diff 검토, 이슈와 PR의 1:1 범위, 브랜치·커밋 규칙, Definition of Done, 실제 검증 결과, 문서 동기화, AI 사용 공개, 롤백 정보와 사람 승인을 갖춘 리뷰 가능한 PR 본문을 만드는 요청에서 적용한다.
---

# MCM PR 준비

변경 내용을 증거와 함께 검증하고 사람이 안전하게 리뷰할 수 있는 PR로 정리한다.

## 1. 변경 범위 감사

`AGENTS.md`, `AI_RULES.md`, `docs/PROJECT_CONTEXT.md`, `docs/COLLABORATION.md`, `.github/PULL_REQUEST_TEMPLATE.md`를 읽는다. `mcm-reborn/` 변경이 있으면 `mcm-reborn/AGENTS.md`와 `mcm-reborn/package.json`도 읽는다. 그다음 현재 브랜치, 기준 브랜치, 상태, diff, 커밋을 확인한다.

다음을 점검한다.

- 최신 `develop`에서 시작한 `feature-*`, `bugfix-*`, `hotfix-*` 브랜치다.
- `main` 또는 `develop`에 직접 push하는 변경이 아니다.
- PR 하나가 연결된 이슈 하나와 사용자 결과 하나만 해결한다.
- 관련 없는 변경, 생성물, 임시 파일, 비밀값, 개인 정보가 없다.
- 승인 없는 새 패키지·프레임워크 또는 API 계약 변경이 없다.
- 사용자의 기존 변경을 덮어쓰거나 임의로 되돌리지 않았다.

범위 밖 변경은 임의로 삭제하지 말고 분리 방법과 위험을 보고한다.

## 2. Definition of Done 검증

- 이슈의 완료 조건을 항목별로 실제 변경과 연결한다.
- 정상, 오류, 빈 상태, 권한 경로를 확인한다.
- 관련 lint, 타입 검사, 테스트, 빌드를 실행한다.
- UI 변경은 로딩·실패·반응형 상태와 필요한 스크린샷을 확인한다.
- API 변경은 프론트엔드·백엔드 승인과 OpenAPI·Mock·DB·코드 정합성을 확인한다.
- README, API 가이드, `docs/`와 예시가 현재 동작을 설명하는지 확인한다.
- 스테이징 또는 데모 경로에 미치는 영향을 기록한다.

실행하지 않은 검사를 성공으로 표시하지 않는다. 실패가 있으면 재현 명령과 원인을 남기고 준비 완료로 선언하지 않는다.

`mcm-reborn/` 변경에는 저장소 루트에서 다음을 실행한다.

```text
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다. 현재 자동 테스트 스크립트가 없으므로 테스트를 통과했다고 표시하지 말고 검증 공백으로 기록한다. API 패키지 변경에는 `python validate_package.py`, 협업 인프라 변경에는 `python -X utf8 scripts/validate_collaboration.py`를 실행한다.

## 3. 커밋 준비

커밋 메시지는 변경 성격에 맞춰 `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore` 중 하나를 사용한다. 브랜치 생성, 커밋, 원격 push 또는 PR 생성은 사용자나 연결된 이슈가 명시적으로 요청했을 때만 수행한다.

커밋 전 `git diff --check`와 관련 검증을 다시 확인한다. 자동 생성 문구나 공동 작성자 표기는 실제 작업 방식과 팀 정책에 맞을 때만 추가한다.

## 4. PR 본문 작성

저장소 템플릿을 사용해 다음을 사실대로 작성한다.

- 목적과 연결된 이슈
- 주요 변경과 명시적 제외 범위
- 정상·오류·빈 상태·권한별 검증 결과
- 실행한 명령과 결과
- API·DB·환경 변수·새 패키지 영향
- 스크린샷 또는 데모 방법
- 롤백 방법과 알려진 위험
- 사용한 AI 도구, 맡긴 작업, 사람이 직접 확인한 범위

AI가 초안을 작성했거나 코드를 생성·수정·검토했다면 숨기지 말고 구체적으로 공개한다.

## 5. 리뷰 게이트 유지

- CI와 필수 검사가 통과하기 전 병합하지 않는다.
- 작성자가 자신의 PR을 승인하지 않는다.
- 최소 한 명의 사람 리뷰와 필요한 프론트엔드·백엔드 승인을 받는다.
- 리뷰 의견과 실패한 검사 결과를 해결한 뒤 준비 상태를 다시 확인한다.
- 긴급 수정도 `hotfix-*` 브랜치와 사후 기록·검증을 생략하지 않는다.

최종 보고에는 준비 완료 여부, 차단 항목, 검증 증거, 권장 PR 제목과 본문을 포함한다.
