<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MCM RE:BORN application bridge

이 파일은 저장소 루트의 `../AGENTS.md`와 `../AI_RULES.md`를 대체하지 않는다. `mcm-reborn/`에서 작업하기 전에 루트 지침, `../docs/PROJECT_CONTEXT.md`, `../docs/REPOSITORY_STRUCTURE.md`와 관련 계약을 먼저 읽고, 위 자동 생성 Next.js 규칙을 추가로 따른다.

## 애플리케이션 구조

- 애플리케이션 루트와 `package.json`은 `mcm-reborn/`에 있다.
- 현재 App Router 소스는 `app/`, 공개 자산은 `public/`에 있다. 별도 승인 없이 `src/app/` 전환이나 광범위한 구조 이동을 하지 않는다.
- HTTP 계약, Mock과 DB 기준은 각각 `../openapi.yaml`, `../mock-data.json`, `../supabase-schema.sql`이다. Route Handler나 공유 API 타입이 이를 바꾸면 루트의 계약 변경 절차를 적용한다.
- Next.js 코드를 쓰기 전에 설치된 버전과 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.

## 검증과 Git 게이트

저장소 루트에서 다음 명령을 실행한다.

```text
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

의존성 재현이 필요하면 먼저 `npm --prefix mcm-reborn ci`를 실행한다. 현재 `package.json`에는 자동 테스트 스크립트가 없으므로 테스트 성공을 주장하지 말고 검증 공백으로 기록한다.

`main`과 `develop`에 직접 push하지 않는다. 브랜치 생성, 커밋, push, PR 생성과 병합은 명시적으로 요청된 범위에서만 수행한다. 작성자는 자신의 PR을 승인하지 않으며 병합은 사람의 승인과 필수 검사 뒤 팀 권한 정책을 따른다.
