# MCM RE:BORN 백엔드 설정 가이드

## 1️⃣ 환경변수 설정

### `.env.local` 생성
```bash
cd mcm-reborn
cp .env.local.example .env.local  # 이미 존재하면 스킵
```

### 필수 환경변수

```bash
# Public - 브라우저에 노출됨
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Server only - 절대 NEXT_PUBLIC_ 접두사 사용 금지
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # service_role 키
OPENAI_API_KEY=sk-proj-... # OpenAI API 키
OPENAI_VISION_MODEL=gpt-4o # 또는 gpt-4-turbo, gpt-4o-mini

# AI 모드: live | fixture | hybrid
AI_MODE=hybrid

# 자동 진행 프로필: FAST_DEMO | STATIC
DEMO_TIMELINE_PROFILE=FAST_DEMO

# 데모 로그인 활성화
ENABLE_DEMO_LOGIN=true
```

### 환경변수 획득 방법

**Supabase:**
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. Settings > API
4. `URL`, `anon public`, `service_role` 복사

**OpenAI:**
1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. 키 복사 (한 번만 표시됨)

## 2️⃣ Supabase 스키마 적용

### A. SQL Editor에서 실행

1. Supabase Dashboard > SQL Editor
2. `New query` 클릭
3. `supabase-schema.sql` 전체 내용 복사
4. `Run` 실행

### B. 생성되는 리소스

**테이블 (9개):**
- `profiles` - 사용자 프로필 (CUSTOMER/OPERATOR)
- `media_assets` - 업로드 이미지
- `analyses` - AI 분석 결과
- `analysis_images` - 분석-이미지 연결
- `manual_review_cases` - 수동 검토 케이스
- `products` - 제품 카탈로그
- `applications` - 업사이클링 신청
- `mock_payments` - Mock 결제
- `esg_certificates` - ESG 보증서

**Storage Buckets (2개):**
- `source-products` (Private) - 고객 업로드 이미지
- `catalog-assets` (Public) - 제품 이미지, 3D 모델

**RLS 정책:**
- 고객은 본인 데이터만 조회
- 운영자는 모든 데이터 조회 가능
- 원본 이미지는 소유자·운영자만 접근

## 3️⃣ 데모 계정 생성

### A. Supabase Auth에서 수동 생성

```sql
-- 1. 고객 계정
-- Supabase Dashboard > Authentication > Users > Invite user
-- Email: demo-customer@mcm-reborn.example
-- Password: demo-password-2026

-- 2. 운영자 계정
-- Email: demo-operator@mcm-reborn.example
-- Password: demo-password-2026
```

### B. Profiles 연결

```sql
-- 고객 프로필
insert into public.profiles (id, role, display_name)
values (
  (select id from auth.users where email = 'demo-customer@mcm-reborn.example'),
  'CUSTOMER',
  '김민지'
);

-- 운영자 프로필
insert into public.profiles (id, role, display_name)
values (
  (select id from auth.users where email = 'demo-operator@mcm-reborn.example'),
  'OPERATOR',
  'MCM RE:BORN 운영자'
);
```

## 4️⃣ 제품 Seed 데이터

```sql
-- mock-data.json의 제품 3개를 DB에 삽입
-- (supabase-schema.sql 하단에 포함되어 있음)
insert into public.products (id, code, name, category, ...) values (...);
```

제품별 필수 자산:
- `list.webp` - 목록 이미지 (1200x1500, 4:5)
- `poster.webp` - 3D 포스터
- `model.glb` - 3D 모델

## 5️⃣ 개발 서버 실행

```bash
# 루트에서 실행
npm --prefix mcm-reborn ci          # 의존성 재설치
npm --prefix mcm-reborn run dev     # 개발 서버 시작
```

**접속:**
- http://localhost:3000
- API: http://localhost:3000/api/v1/health

## 6️⃣ 검증

### A. 타입 체크
```bash
npm --prefix mcm-reborn run typecheck
# ✅ 통과 확인
```

### B. Lint
```bash
npm --prefix mcm-reborn run lint
# ✅ 통과 확인
```

### C. 빌드
```bash
npm --prefix mcm-reborn run build
# ⚠️ 환경변수 설정 후 실행
```

### D. API 테스트

**1. Health Check**
```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","version":"1.1.0","timestamp":"...","aiMode":"hybrid"}
```

**2. 데모 로그인**
```bash
curl -X POST http://localhost:3000/api/v1/auth/demo-login \
  -H "Content-Type: application/json" \
  -d '{"demoAccount":"CUSTOMER"}'
# {"user":{...},"session":{"accessToken":"...","refreshToken":"...","expiresAt":"..."}}
```

**3. 인증 필요 API**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl http://localhost:3000/api/v1/me \
  -H "Authorization: Bearer $TOKEN"
# {"id":"...","role":"CUSTOMER","displayName":"김민지","email":"..."}
```

## 7️⃣ 문제 해결

### "Missing Supabase environment variables"
→ `.env.local` 확인, `NEXT_PUBLIC_SUPABASE_URL` 등 설정

### "OPENAI_API_KEY is not configured"
→ OpenAI API 키 설정, `AI_MODE=fixture`로 임시 우회 가능

### "Table 'profiles' does not exist"
→ `supabase-schema.sql` 전체 실행 확인

### "Demo login is not enabled"
→ `ENABLE_DEMO_LOGIN=true` 설정

### Build 오류
→ `.next` 폴더 삭제 후 재빌드
```bash
cd mcm-reborn
rm -rf .next
npm run build
```

## 8️⃣ 다음 단계

1. **프론트엔드 연동**
   - 다른 팀원의 브랜치에서 UI 코드 Pull
   - API 호출 테스트

2. **데모 시나리오 준비**
   - 제품 3D 모델 업로드
   - 테스트 이미지 준비
   - 전체 플로우 검증

3. **배포**
   - Vercel 연결
   - 환경변수 설정
   - Production 빌드 테스트
