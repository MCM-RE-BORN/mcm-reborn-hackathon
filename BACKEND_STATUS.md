# 백엔드 구현 상태

## ✅ 구현 완료된 API (10개)

| Method | Path | 파일 | 상태 |
|--------|------|------|------|
| `GET` | `/health` | `app/api/v1/health/route.ts` | ✅ 완료 |
| `POST` | `/auth/demo-login` | `app/api/v1/auth/demo-login/route.ts` | ✅ 완료 |
| `GET` | `/me` | `app/api/v1/me/route.ts` | ✅ 완료 |
| `POST` | `/uploads/presign` | `app/api/v1/uploads/presign/route.ts` | ✅ 완료 |
| `POST` | `/analyses` | `app/api/v1/analyses/route.ts` | ✅ 완료 |
| `GET` | `/analyses` | `app/api/v1/analyses/route.ts` | ✅ 완료 |
| `GET` | `/products` | `app/api/v1/products/route.ts` | ✅ 완료 |
| `GET` | `/products/{productId}` | `app/api/v1/products/[productId]/route.ts` | ✅ 완료 |
| `POST` | `/applications` | `app/api/v1/applications/route.ts` | ✅ 완료 |
| `POST` | `/applications/{applicationId}/mock-payment` | `app/api/v1/applications/[applicationId]/mock-payment/route.ts` | ✅ 완료 |
| `POST` | `/admin/applications/{applicationId}/approve` | `app/api/v1/admin/applications/[applicationId]/approve/route.ts` | ✅ 완료 |

## ⚠️ 미구현 API (OpenAPI 대비 누락, 9개)

### 필수 (P0~P1)
| Method | Path | 우선순위 | 필요성 |
|--------|------|----------|--------|
| `GET` | `/analyses/{analysisId}` | P1 | 분석 결과 상세 조회 |
| `GET` | `/applications/{applicationId}` | P0 | 신청 상세 조회 (고객·운영자) |
| `GET` | `/applications` | P1 | 내 신청 목록 |
| `GET` | `/applications/{applicationId}/timeline` | P1 | 진행 타임라인 |
| `GET` | `/admin/applications` | P0 | 운영자 신청 목록 |
| `GET` | `/admin/applications/{applicationId}` | P1 | 운영자 신청 상세 |

### 선택 (P2)
| Method | Path | 우선순위 | 필요성 |
|--------|------|----------|--------|
| `GET` | `/applications/{applicationId}/shipment` | P2 | Mock 운송장 조회 |
| `GET` | `/applications/{applicationId}/certificate` | P2 | ESG 보증서 |
| `GET` | `/certificates/{certificateId}/verify` | P2 | 보증서 검증 |
| `POST` | `/events` | P2 | KPI 이벤트 기록 |

## 📊 구현된 서버 로직 (13개)

### 핵심 서비스
- `server/analyses/analysisService.ts` - 분석 생성, 추천 계산
- `server/applications/applicationService.ts` - 신청 생성, 검증
- `server/applications/resolveMockStatus.ts` - 자동 상태 계산
- `server/products/productService.ts` - 제품 조회
- `server/payments/mockPaymentAdapter.ts` - Mock 결제

### AI 분석
- `server/openai/OpenAiVisionProvider.ts` - OpenAI 실제 분석
- `server/openai/FixtureVisionProvider.ts` - Fixture 제공자
- `server/openai/HybridVisionProvider.ts` - 폴백 처리
- `server/openai/visionProviderFactory.ts` - 제공자 팩토리

### 인프라
- `server/auth/middleware.ts` - JWT 인증, 권한 검사
- `server/auth/errorHandler.ts` - 오류 처리
- `server/storage/uploadService.ts` - 이미지 업로드
- `server/recommendation/calculateRecommendations.ts` - 추천 계산

### 계약
- `contracts/errors.ts` - 오류 타입
- `contracts/analysis.ts` - 분석 스키마
- `contracts/product.ts` - 제품 타입
- `contracts/application.ts` - 신청 타입

## 📝 다음 작업

### 1단계: 필수 API 완성 (P0~P1)
```bash
# 신청 조회 API
app/api/v1/applications/[applicationId]/route.ts
app/api/v1/applications/[applicationId]/timeline/route.ts

# 분석 상세
app/api/v1/analyses/[analysisId]/route.ts

# 운영자
app/api/v1/admin/applications/route.ts
app/api/v1/admin/applications/[applicationId]/route.ts
```

### 2단계: 선택 API (P2)
```bash
# ESG 보증서
app/api/v1/applications/[applicationId]/certificate/route.ts
app/api/v1/applications/[applicationId]/shipment/route.ts
app/api/v1/certificates/[certificateId]/verify/route.ts

# 분석
app/api/v1/events/route.ts
```

### 3단계: 환경 설정
- `.env.local` 환경변수 설정
- Supabase 스키마 적용
- 데모 계정 생성

### 4단계: 검증
- API 테스트
- 타입 체크
- 빌드 확인
