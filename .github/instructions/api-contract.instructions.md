---
applyTo: "openapi.yaml,mock-data.json,supabase-schema.sql,supabase/migrations/**/*.sql,MCM_REBORN_API_GUIDE.md,examples/**/*.ts,examples/**/*.tsx,mcm-reborn/app/api/**/*.ts,mcm-reborn/server/**/*.ts,mcm-reborn/lib/api/**/*.ts,mcm-reborn/lib/contracts/**/*.ts,mcm-reborn/contracts/**/*.ts,mcm-reborn/types/api/**/*.ts"
---

# API 계약 파일 작업 규칙

- 편집 전에 `docs/API_CONTRACT.md`, `docs/PROJECT_CONTEXT.md`, `AGENTS.md`를 확인한다.
- 경로, 메서드, 인증, 요청·응답·오류, 상태값, Mock 공개 형태, DB 스키마·RLS 변경은 계약 변경으로 취급한다.
- 별도 이슈와 프론트엔드·백엔드 양쪽 승인이 없으면 영향 분석과 제안만 작성하고 계약·구현 파일은 변경하지 않는다.
- 승인된 변경은 OpenAPI 스키마·예시 → Mock·타입 → 서버·DB → 클라이언트 → 통합 테스트·문서 순서로 반영한다.
- `openapi.yaml`을 HTTP API의 기계 판독 기준으로 삼고 Mock, 예시, DB 제약, 상태 전이를 함께 검증한다.
- 인증 주체, 소유권, RLS, 멱등성, 재시도, 마이그레이션과 롤백 영향을 명시한다.
- 비밀값이나 실제 고객 데이터를 예시에 넣지 않으며 실행하지 않은 검사를 통과했다고 표현하지 않는다.
- `mcm-reborn/` 구현이 바뀌면 저장소 루트에서 `npm --prefix mcm-reborn run lint`, `npm --prefix mcm-reborn run typecheck`, `npm --prefix mcm-reborn run build`를 실행한다. 현재 자동 테스트 스크립트가 없으므로 테스트 성공을 주장하지 않는다.
