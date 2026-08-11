# 저장소 구조와 파일 소유권

이 저장소는 루트의 제품·협업 계약과 `mcm-reborn/`의 실행 앱을 분리한다. 기준 문서나 계약을 앱 폴더로 옮기거나 복제하지 않는다.

## 루트 소유 영역

| 경로 | 책임 |
|---|---|
| `AGENTS.md`, `AI_RULES.md`, `CONTRIBUTING.md` | 저장소 전체 협업·에이전트 규칙 |
| `docs/` | MVP 범위, 흐름, 계약 운영, 결정과 데모 기준 |
| `.agents/skills/` | 저장소 전용 에이전트 작업 절차 |
| `.github/` | Copilot 지침, 이슈·PR 템플릿 |
| `openapi.yaml` | HTTP API의 기계 판독 기준 |
| `mock-data.json` | 데모 Fixture 계약 |
| `supabase-schema.sql` | bootstrap DB·RLS·Storage 계약 |
| `MCM_REBORN_API_GUIDE.md`, `examples/`, `prompts/` | 구현 가이드와 기준 예시 |
| `.env.example` | 저장소의 환경변수 이름과 안전한 기본값 |
| `.gitattributes`, `.gitignore` | 줄바꿈 정규화와 생성물·비밀 환경파일 제외 규칙 |
| `scripts/`, `validate_package.py` | 저장소·계약 검증 도구 |

루트 `examples/`는 참고 구현이다. 앱이 이를 런타임에 직접 참조한다고 가정하지 말고, 실제 적용은 관련 계약을 유지한 채 앱 소유 경로로 구현한다.

## 앱 소유 영역

`mcm-reborn/`은 Next.js `16.3.0`, React `19.2.8` 실행 앱의 루트다. 현재는 기본 scaffold이며 MVP 기능 구현 완료 상태가 아니다.

| 향후 경로 | 책임 |
|---|---|
| `mcm-reborn/app/` | App Router 페이지, 레이아웃, Route Handler |
| `mcm-reborn/app/api/v1/` | `openapi.yaml`을 구현하는 HTTP API Route Handler |
| `mcm-reborn/components/` | 여러 화면에서 재사용하는 UI 컴포넌트 |
| `mcm-reborn/server/` | 인증, 도메인 서비스, Supabase·OpenAI adapter와 서버 전용 로직 |
| `mcm-reborn/lib/` | Supabase·OpenAPI 연결 등 프레임워크 공용 유틸리티 |
| `mcm-reborn/contracts/` | OpenAPI에서 파생하거나 수동 관리하는 앱 타입·상수 |
| `mcm-reborn/public/assets/products/` | 공개 가능한 제품 목록·poster 이미지 |
| `mcm-reborn/public/assets/models/` | 공개 가능한 GLB·glTF 자산 |
| `mcm-reborn/tests/` | 향후 단위·통합 테스트 |

고객 원본 사진은 `public/`에 넣지 않고 Supabase private bucket에 저장한다. 비밀키, 실제 고객 데이터와 운영 로그도 저장소에 추가하지 않는다.

DB migration 체계를 도입하면 루트 `supabase/migrations/`를 사용하고 `supabase-schema.sql` bootstrap과의 관계·롤백 절차를 계약 변경 이슈에 기록한다.

## 지침 적용 순서

저장소 전체 작업에는 루트 `AGENTS.md`가 적용된다. 앱 파일을 다룰 때는 `mcm-reborn/AGENTS.md`의 Next.js 버전 규칙도 함께 적용한다. 두 지침이 충돌하면 더 구체적인 앱 규칙을 따르되 제품 범위·보안·승인 게이트는 루트 규칙을 유지한다.

## 환경 설정

루트 `.env.example`을 단일 기준으로 유지한다. 실제 로컬 값은 추적하지 않는 `mcm-reborn/.env.local`에 둔다.

```powershell
Copy-Item .\.env.example .\mcm-reborn\.env.local
```

## 검증 명령

저장소 루트에서 계약과 협업 파일을 검증한다.

```bash
python validate_package.py
python -X utf8 scripts/validate_collaboration.py
```

앱 검증도 저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `mcm-reborn/package.json`에는 테스트 스크립트가 없다. 테스트를 추가하면 같은 PR에서 실제 테스트 명령을 `package.json`, 이 문서와 PR 검증 항목에 함께 등록한다.
