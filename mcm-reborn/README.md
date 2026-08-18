# MCM RE:BORN Web

이 디렉터리는 MCM RE:BORN 2주 해커톤 MVP의 Next.js 16 애플리케이션이다. 현재 고객 데모 화면·브라우저 카메라·중앙 Fixture 여정과 운영자 lifecycle command Route Handler를 포함하지만, 전체 API와 영속 고객 여정이 완료된 상태는 아니다. API 의미와 MVP 범위는 저장소 루트의 계약 및 제품 문서를 기준으로 구현한다.

## 작업 전 확인

- 저장소 전체 규칙: [`../AGENTS.md`](../AGENTS.md), [`../AI_RULES.md`](../AI_RULES.md)
- 앱 전용 규칙: [`AGENTS.md`](AGENTS.md)
- MVP 범위: [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md), [`../docs/PRD.md`](../docs/PRD.md)
- 사용자 흐름: [`../docs/USER_FLOW.md`](../docs/USER_FLOW.md)
- API 계약 절차: [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md)
- 기계 판독 API 계약: [`../openapi.yaml`](../openapi.yaml)
- 구현 가이드: [`../MCM_REBORN_API_GUIDE.md`](../MCM_REBORN_API_GUIDE.md)

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

`mcm-reborn/.env.local`에 로컬 OpenAI·Supabase 값을 설정한다. `OPENAI_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`에는 `NEXT_PUBLIC_` 접두사를 붙이지 않으며 파일을 커밋하지 않는다.

운영자 lifecycle command Route Handler는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 모두 필요하다. 서비스 역할 키는 멱등성 예약·캐시에만 사용하고, lifecycle RPC와 배송 조회는 요청의 Bearer 토큰으로 운영자 권한과 RLS를 적용한다. 환경변수가 비어 있으면 이 Route Handler는 명시적인 `503 SERVICE_UNAVAILABLE`을 반환한다.

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
