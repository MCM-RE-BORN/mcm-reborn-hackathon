# MCM RE:BORN Web

이 디렉터리는 MCM RE:BORN 데모 MVP의 Next.js 16 애플리케이션이다. 고객 화면·브라우저 카메라·신청·보증서와 OpenAPI 25개 API operation을 구현하는 23개 v2 Route Handler 파일·서비스를 포함한다. 고객·운영 화면은 Supabase v2 API 응답을 사용하고, 인증 실패·빈 결과는 상태 화면으로 표시한다. 실제 CUSTOMER/OPERATOR 자격증명을 사용한 전체 원격 여정과 OpenAI LIVE 호출은 별도 staging 검증 대상이며 API 의미와 MVP 범위는 저장소 루트의 계약을 따른다.

## 작업 전 확인

- 저장소 전체 규칙: [`../AGENTS.md`](../AGENTS.md), [`../AI_RULES.md`](../AI_RULES.md)
- 앱 전용 규칙: [`AGENTS.md`](AGENTS.md)
- MVP 범위: [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md), [`../docs/PRD.md`](../docs/PRD.md)
- 사용자 흐름: [`../docs/USER_FLOW.md`](../docs/USER_FLOW.md)
- API 계약 절차: [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md)
- 기계 판독 API 계약: [`../openapi.yaml`](../openapi.yaml)
- 구현 가이드: [`../MCM_REBORN_API_GUIDE.md`](../MCM_REBORN_API_GUIDE.md)
- 백엔드 v2 설계 요약: [`../docs/BACKEND_V2_DESIGN.md`](../docs/BACKEND_V2_DESIGN.md)
- AI 분석·추천·텍스처·3D 파이프라인: [`../docs/AI_TEXTURE_MOCKUP_PIPELINE.md`](../docs/AI_TEXTURE_MOCKUP_PIPELINE.md)

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

Node.js 22.18.0 이상에서 실행한다. `mcm-reborn/.env.local`에 로컬 OpenAI·Supabase 값을 설정한다. `OPENAI_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`에는 `NEXT_PUBLIC_` 접두사를 붙이지 않으며 파일을 커밋하지 않는다. 기본값은 `AI_MODE=DEMO_FIXTURE`, `ENABLE_EXTERNAL_AI=false`, `ENABLE_DEMO_LOGIN=false`다.

v2 영속 API는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 고객 조회·결정과 운영자 RPC는 요청 Bearer token과 RLS를 적용하고, service role 쓰기는 서버에서 인증·소유권·역할 확인 뒤 제한적으로 사용한다. 환경변수가 비어 있으면 health는 `degraded`, 영속 경로는 `503 SERVICE_UNAVAILABLE`을 반환한다.

`AI_MODE=LIVE`는 `ENABLE_EXTERNAL_AI=true`, 고정된 `EXTERNAL_AI_PRIVACY_NOTICE_VERSION`, OpenAI 서버 설정과 요청별 명시 동의를 모두 요구한다. 실제 연결 전에는 private 이미지를 외부로 전송하지 말고 `DEMO_FIXTURE`를 사용한다.

LIVE의 위키 조회와 최종 분석은 한 서버 프로세스에서 분석 단위로 직렬화하고 하나의 제한된 deadline을 공유한다. 위키 조회의 rate limit·quota·인증 실패 뒤에는 최종 6장 호출을 추가로 보내지 않는다. 최종 분석의 일시적 429만 `Retry-After` 또는 소진 bucket reset과 jitter 뒤 한 번 재시도하며, quota·billing 한도는 즉시 canonical Fixture로 복구한다. 이 폴백 결과에는 `API오류로 인한 DEMO`가 작게 표시되고 allowlist 진단은 고객 조회 행이 아닌 서버 로그에만 남긴다.

목업 상세의 로컬 텍스처 추출·GLB 결합은 외부 키 없이 동작한다. 선택형 OpenAI/Meshy 텍스처 기능은 `ENABLE_TEXTURE_AI=true`와 provider별 서버 키가 필요하며, Meshy에는 32자 이상의 `TEXTURE_TASK_SIGNING_SECRET`과 공개 HTTPS `.glb` URL도 필요하다. 실제 고객 사진을 전송하기 전에 [`AI_TEXTURE_MOCKUP_PIPELINE.md`](../docs/AI_TEXTURE_MOCKUP_PIPELINE.md)의 동의·보존·비용·시연 절차를 확인한다.

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
npm --prefix mcm-reborn run test:analysis-fallback
npm --prefix mcm-reborn run test:openai-policy
npm --prefix mcm-reborn run test:provider-fallback
npm --prefix mcm-reborn run build
```

native Node 테스트는 LIVE OpenAI 요청 정책, canonical 제공자 폴백과 API 오류 DEMO 표기 조건을 검증한다. 루트 계약이나 협업 문서를 변경했다면 루트 README의 Python 검증 명령도 함께 실행한다.
