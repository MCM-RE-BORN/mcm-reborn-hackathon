---
name: mcm-work-on-issue
description: MCM RE:BORN 저장소의 루트 API 패키지나 `mcm-reborn/` Next.js 앱에서 기능 개발, 버그 수정, 리팩터링, 테스트 또는 문서 이슈를 계획하고 구현할 때 사용한다. 이슈 착수, 코드 변경, 작업 범위 판단, 완료 조건 검증 요청이 들어오면 적용하며, 팀의 Definition of Ready/Done, develop 기준 브랜치, 최소 변경 범위, 검증 및 문서화 규칙을 강제한다.
---

# MCM 이슈 작업

MCM RE:BORN의 협업 계약을 지키면서 이슈 하나를 안전하게 구현한다.

## 1. 기준 문서 읽기

작업 전에 다음 순서로 읽는다.

1. `AGENTS.md`
2. `AI_RULES.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/COLLABORATION.md`
5. `mcm-reborn/` 작업이면 `mcm-reborn/AGENTS.md`와 `mcm-reborn/package.json`

API 경로나 요청·응답·오류·상태·DB 스키마가 달라지면 `docs/API_CONTRACT.md`도 읽고 `$mcm-change-api-contract`를 적용한다. 커밋, 푸시 또는 PR 준비 단계에서는 `$mcm-prepare-pull-request`를 적용한다.

HTTP API의 기계 판독 기준은 `openapi.yaml`이지만 제품 범위와 흐름의 기준은 `docs/PROJECT_CONTEXT.md`, `docs/PRD.md`, `docs/USER_FLOW.md`다. 문서끼리 또는 문서와 구현이 충돌하면 임의로 선택하지 말고 차이와 영향을 보고한 뒤 승인을 받는다.

루트에는 계약·Mock·DB·협업 문서가 있고 실제 Next.js 앱은 `mcm-reborn/`에 있다. 현재 App Router 소스는 `mcm-reborn/app/`이며, 설치된 Next.js의 관련 규칙은 `mcm-reborn/node_modules/next/dist/docs/`에서 확인한다.

## 2. 착수 조건 확인

다음 Definition of Ready를 확인한다.

- 담당자와 연결된 이슈가 있다.
- 사용자 문제와 기대 효과가 명확하다.
- 정상·오류·빈 상태·권한별 완료 조건이 있다.
- 제외 범위와 의존성이 기록되어 있다.
- 화면 설계 또는 API 계약이 필요한 수준으로 정리되어 있다.

결과를 바꿀 핵심 정보가 없으면 편집 전에 사용자에게 질문한다. 안전하고 되돌릴 수 있는 세부 사항만 명시적으로 가정한다. 하루를 넘길 것으로 보이는 작업은 독립적으로 검증 가능한 이슈로 나눌 것을 제안한다.

## 3. 범위 고정

1. 현재 브랜치와 작업 트리를 확인한다.
2. 새 작업이면 최신 `develop`에서 `feature-*`, `bugfix-*`, `hotfix-*` 중 맞는 브랜치를 사용한다.
3. 기존 구현 패턴, 타입, 패키지 버전, 관련 테스트를 먼저 찾는다.
4. 수정할 파일과 실행할 검증 명령을 작업 전에 정한다.
5. 하나의 이슈와 하나의 사용자 결과만 이번 변경에 포함한다.

사용자의 기존 변경을 보존한다. 관련 없는 파일을 정리하거나 되돌리지 않는다.

## 4. 최소 변경 구현

- 기존 구조와 라이브러리를 재사용한다.
- 승인 없는 프레임워크·패키지 추가, 전면 재작성, 임의 API 변경을 하지 않는다.
- 비밀값, 개인 정보, 운영 자격 증명을 코드·로그·문서에 넣지 않는다.
- 테스트를 삭제하거나 통과시키기 위해 검증 강도를 낮추지 않는다.
- 2주 MVP 범위를 우선하고 이후 로드맵 기능을 섞지 않는다.
- 현재 이슈에서 승인받은 동작 변경 때문에 코드와 계약이 함께 달라지는 경우에만 `$mcm-change-api-contract` 절차로 문서를 동기화한다. 기존 불일치나 미승인 변경은 임의로 고치지 말고 차이와 영향을 보고한다.

## 5. 완료 검증

변경 위험에 비례해 다음을 검증한다.

- 정상, 오류, 빈 상태, 권한 거부 경로
- 관련 단위·통합 테스트
- lint, 타입 검사, 테스트, 빌드 중 저장소에 존재하는 명령
- UI 변경 시 주요 화면과 실패·로딩 상태
- 계약 변경 시 OpenAPI, Mock, 타입, 서버, 클라이언트, DB 간 정합성

실행하지 못한 검사는 통과했다고 말하지 말고 이유와 수동 확인 방법을 남긴다.

`mcm-reborn/` 변경은 저장소 루트에서 다음 명령으로 검증한다.

```text
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다. 현재 자동 테스트 스크립트가 없으므로 테스트를 실행하거나 통과했다고 표현하지 말고 검증 공백을 기록한다. API 패키지 변경에는 `python validate_package.py`, 협업 인프라 변경에는 `python -X utf8 scripts/validate_collaboration.py`도 실행한다.

## 6. 결과 보고

다음 내용을 간결하게 보고한다.

- 해결한 사용자 문제와 변경 범위
- 변경 파일과 주요 판단
- 실행한 명령과 실제 결과
- 남은 위험, 제외 범위, 후속 이슈
- 사용자 승인이나 리뷰가 필요한 항목
