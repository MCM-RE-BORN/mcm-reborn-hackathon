# MCM RE:BORN Hackathon API Package

2주 해커톤에서 바로 사용할 수 있도록 API 계약, 구현 가이드, Mock 데이터, Supabase 스키마와 OpenAI 분석 예시를 묶은 패키지입니다.

이 저장소의 `develop` 브랜치를 2주 MVP의 단일 기준(source of truth)으로 사용합니다. 별도 PRD와 유저 플로우의 장인 분리, 실제 정품 검증, 실물 검수·재승인, 생산 용량, 공식 A/S, 감사 및 iOS 범위는 Post-MVP / Phase 2 로드맵입니다.

## 포함 파일

| 파일 | 용도 |
|---|---|
| `MCM_REBORN_API_GUIDE.md` | 전체 범위, 아키텍처, API 사용법, 상태 모델, 2주 일정 |
| `openapi.yaml` | OpenAPI 3.1 계약 |
| `mock-data.json` | 제품 3종, AI·재촬영·수동 검토 Fixture, 정상·예외 신청, 보증서 |
| `supabase-schema.sql` | 테이블, RLS, Storage 정책, 제품 Seed |
| `.env.example` | 환경변수 템플릿 |
| `prompts/bag-analysis.system.txt` | OpenAI 분석 시스템 프롬프트 |
| `examples/openai-analysis.ts` | Responses API + 이미지 + Zod Structured Output 예시 |
| `examples/mock-status.ts` | 승인 후 자동 진행 상태 계산 예시 |
| `examples/recommendation.ts` | 결정론적 수율·추천·Mock ESG 계산 |
| `examples/Product3DViewer.tsx` | 모든 제품 상세에서 사용할 3D 뷰어 예시 |
| `examples/model-viewer.d.ts` | React JSX custom element 타입 예시 |
| `validate_package.py` | OpenAPI·Mock·AI 예시·핵심 SQL 보안 불변조건 검증 |

## 확정된 UX 계약

- 고객용 웹과 `OPERATOR` 통합 운영 대시보드를 구현합니다.
- 운영자 대시보드는 신청 목록·상세·승인 버튼만 제공합니다.
- 이미지 분석은 OpenAI API를 실제 사용합니다.
- `AI_MODE=hybrid`에서 제공자 오류 시 Fixture로 폴백합니다.
- 사진 품질이 분석 기준에 못 미치면 폴백 성공으로 바꾸지 않고 `422 IMAGE_QUALITY_INSUFFICIENT`와 한국어 재촬영 안내를 반환합니다.
- AI는 정품·가품을 확정하지 않습니다. `REVIEW_REQUIRED`는 수동 검토 신호이며, 검토 대상 분석으로는 신청을 생성할 수 없습니다.
- 고객 데이터와 private 원본 이미지는 소유자 기반 RLS·Storage 정책으로 격리하고 운영자만 업무상 조회합니다.
- 제품 목록은 각 결과 제품의 완성형 전체 이미지를 표시합니다.
- 파우치, 카드지갑, 키링의 모든 상세 페이지에서 GLB·glTF 3D 뷰어를 제공합니다.
- 결제, 물류, ESG 산식, 보증서는 Mock입니다.
- 운영자 승인 후 상태는 시간 기반으로 자동 진행합니다.

## 빠른 시작 순서

1. Next.js 프로젝트를 생성하고 Supabase를 연결합니다.
2. `supabase-schema.sql`을 실행합니다.
3. Supabase Auth에 고객·운영자 데모 사용자를 생성하고 `profiles`에 역할을 저장합니다.
4. SQL이 생성한 `source-products` private bucket과 `catalog-assets` public bucket 및 Storage 정책을 확인합니다.
5. 보유한 목록 이미지와 GLB·glTF 자산을 `mock-data.json`의 경로에 맞게 배치하거나 URL을 수정합니다.
6. `.env.example`을 `.env.local`로 복사하고 OpenAI·Supabase 값을 설정합니다.
7. `openapi.yaml`을 기준으로 Route Handler를 구현합니다.
8. `examples/openai-analysis.ts`와 프롬프트를 AI Provider에 적용합니다.
9. `mock-data.json`의 `PENDING_APPROVAL` 신청과 예외 상태를 Seed합니다.
10. 정상, 저품질 재촬영, 정품 수동 검토 차단, AI 장애 폴백 흐름을 각각 리허설합니다.

## 권장 패키지

```bash
npm install openai zod @supabase/ssr @supabase/supabase-js @google/model-viewer
```

OpenAPI TypeScript client를 생성할 경우 팀 표준에 맞는 생성기를 하나만 선택합니다. 생성기 없이 `contracts/` 타입을 직접 관리해도 2주 범위에서는 충분합니다.

## 3D 자산 체크

활성 제품 3종 모두 아래 파일이 필요합니다.

```text
public/assets/products/reborn-pouch/list.webp
public/assets/products/reborn-pouch/poster.webp
public/assets/models/reborn-pouch.glb

public/assets/products/reborn-card-wallet/list.webp
public/assets/products/reborn-card-wallet/poster.webp
public/assets/models/reborn-card-wallet.glb

public/assets/products/reborn-keyring/list.webp
public/assets/products/reborn-keyring/poster.webp
public/assets/models/reborn-keyring.glb
```

보유 자산의 실제 파일명이 다르면 DB Seed와 `mock-data.json`을 함께 변경합니다.

## 공식 참고 문서

- OpenAI Images and vision: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured model outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI API key safety: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- OpenAI project keys: https://help.openai.com/en/articles/5008148-can-i-share-my-api-key-with-my-teammatecoworker
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js route file convention: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Supabase Next.js quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase private buckets and signed URLs: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed uploads: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- model-viewer docs: https://modelviewer.dev/docs/
- model-viewer materials and variants: https://modelviewer.dev/examples/scenegraph/
- Spring Boot Servlet Web Applications: https://docs.spring.io/spring-boot/reference/web/servlet.html

## 패키지 검증

```bash
python validate_package.py
```

PyYAML이 필요합니다. 성공 시 API 참조·operationId·제품 자산과 재촬영·수동 검토 차단·핵심 SQL 접근 정책의 정합성 검증 결과를 출력합니다.

## 중요 고지

이 패키지의 제품 가격, 재사용 면적, 재활용률, 탄소 절감량, 정품 관련 신호, 결제, 물류, 보증서는 모두 해커톤 시연을 위한 가상 데이터입니다. 실제 서비스처럼 오인되지 않도록 UI와 발표 자료에 이를 표시해야 합니다.
