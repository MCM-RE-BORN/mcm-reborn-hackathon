# MCM RE:BORN Web

이 디렉터리는 MCM RE:BORN 데모 MVP의 Next.js 16 애플리케이션이다. 고객 데모 화면·브라우저 카메라·중앙 Fixture 여정과 OpenAPI 25개 API operation을 구현하는 23개 v2 Route Handler 파일·서비스를 포함한다. 화면은 아직 v2 API를 호출하지 않고, 실제 Supabase 프로젝트·migration·OpenAI LIVE 호출도 검증되지 않았다. 코드 구현, UI 통합, 외부 런타임 연결 완료를 구분하며 API 의미와 MVP 범위는 저장소 루트의 계약을 따른다.

## 작업 전 확인

- 저장소 전체 규칙: [`../AGENTS.md`](../AGENTS.md), [`../AI_RULES.md`](../AI_RULES.md)
- 앱 전용 규칙: [`AGENTS.md`](AGENTS.md)
- MVP 범위: [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md), [`../docs/PRD.md`](../docs/PRD.md)
- 사용자 흐름: [`../docs/USER_FLOW.md`](../docs/USER_FLOW.md)
- API 계약 절차: [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md)
- 기계 판독 API 계약: [`../openapi.yaml`](../openapi.yaml)
- 구현 가이드: [`../MCM_REBORN_API_GUIDE.md`](../MCM_REBORN_API_GUIDE.md)
- 백엔드 v2 설계 요약: [`../docs/BACKEND_V2_DESIGN.md`](../docs/BACKEND_V2_DESIGN.md)

## 설정과 실행

저장소 루트에서 의존성을 설치하고 환경변수 템플릿을 복사한다.

```bash
npm --prefix mcm-reborn ci
cp .env.example mcm-reborn/.env.local
```

Windows PowerShell에서는 환경변수 파일을 다음과 같이 복사할 수 있다.

```powershell
Copy-Item .env.example mcm-reborn/.env.local
```

`mcm-reborn/.env.local`에 로컬 OpenAI·Supabase 값을 설정한다. `OPENAI_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`에는 `NEXT_PUBLIC_` 접두사를 붙이지 않으며 파일을 커밋하지 않는다. 기본값은 `AI_MODE=DEMO_FIXTURE`, `ENABLE_EXTERNAL_AI=false`, `ENABLE_DEMO_LOGIN=false`다.

v2 영속 API는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 고객 조회·결정과 운영자 RPC는 요청 Bearer token과 RLS를 적용하고, service role 쓰기는 서버에서 인증·소유권·역할 확인 뒤 제한적으로 사용한다. 환경변수가 비어 있으면 health는 `degraded`, 영속 경로는 `503 SERVICE_UNAVAILABLE`을 반환한다.

`AI_MODE=LIVE`는 `ENABLE_EXTERNAL_AI=true`, 고정된 `EXTERNAL_AI_PRIVACY_NOTICE_VERSION`, OpenAI 서버 설정과 요청별 명시 동의를 모두 요구한다. 실제 연결 전에는 private 이미지를 외부로 전송하지 말고 `DEMO_FIXTURE`를 사용한다.

개발 서버를 시작한다.

```bash
npm --prefix mcm-reborn run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 연다.

## 검증

저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `package.json`에는 자동 테스트 스크립트가 없다. 테스트를 실행했다고 표시하지 말고, 테스트가 추가되기 전까지 이를 남은 검증 공백으로 기록한다. 루트 계약이나 협업 문서를 변경했다면 루트 README의 Python 검증 명령도 함께 실행한다.
