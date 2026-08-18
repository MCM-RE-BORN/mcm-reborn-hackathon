# MVP 베타버전 개발 보고서

> 아래 `## 결과`부터의 본문은 2026-08-14 `feature-mvp-beta-ui` 결과를 보존한 **historical report**다. 2026-08-18 현재 제품 기준은 [`../MVP_DEMO_CANONICAL.md`](../MVP_DEMO_CANONICAL.md)이며, 충돌하는 정적 UI·1~4장/6MB/WebP·주문 전 승인·별도 완료 신청·4탭·`/orders` redirect 설명은 superseded다.

## 2026-08-17 현재 변경 기준

- 원제품은 `MCM 비세토스 모노그램 백팩(2019, 5년 이상)`, 희망 제품은 `RE:BORN 여권지갑`으로 통일한다.
- 접수 `SUB-RB-20260817-0001`, 주문 `RB-20260817-0001`, 보증서 `ESG-RB-20260817-0001`을 하나의 중앙 시나리오로 연결한다.
- 제품 등록은 좌측면·우측면·하단·후면 JPG/JPEG·PNG 사진 4장이 모두 필수이며 장당 최대 10MB다.
- 카메라는 더 이상 정적 진입점만이 아니다. 후면 카메라, 촬영 미리보기, 재촬영·사용, 권한·미지원 파일 폴백을 현재 완료 기준으로 삼는다.
- AI 결과는 중앙 Fixture/seed의 예상 재활용률 72%, 정품 사전 적합도 예상 91%를 사용한다. 정품·제작 가능을 확정하지 않는다.
- Mock 결제 180,000원·수거 무료로 `ORDER_PLACED`를 만든 뒤 제품을 수거한다. 주문 전 운영자/장인 승인 화면 전환은 골든 경로에 없다.
- 주문 후 실물 검수는 `CHANGE_REQUIRED`이며 변경 조건 68%, 195,000원, 4~5주를 고객이 승인한다.
- 같은 주문에서 제작·품질·배송·완료로 진행하고 최종 보증서에 68%, 예상 3.43kg CO2e를 표시한다.
- 2026-08-14의 `PENDING_APPROVAL` 완료 화면과 별도 `COMPLETED` 프레젠테이션 신청 분리는 현재 기준에서 사용하지 않는다.
- 현재 `/`와 `/intro`는 서비스 소개, `/home`은 홈이다. 아래 historical 표의 “홈 `/`”은 2026-08-14 당시 구현 기록이므로 수정하지 않고 현재 라우트가 대체했음을 여기에 명시한다.
- 2026-08-18 현재 홈은 실제 hero 영상과 `상품 진단하기` 공통 CTA를 사용하고, 하단 내비게이션은 `신청 내역`·`홈`·`마이페이지` 3개다.
- 2026-08-14 historical 표의 `/orders` redirect는 현재 사용하지 않는다. `/orders`는 신청 목록이며 상품 선택 후 `/orders/demo` 상세로 이동한다.

### 현재 검증 요구

이 문서 편집 시점에는 병렬로 진행되는 앱·OpenAPI·Mock·DB 변경의 최종 검증 결과를 선기록하지 않는다. 통합 후 다음을 다시 실행하고 실제 결과를 PR 또는 후속 보고서에 기록한다.

```bash
python validate_package.py
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

브라우저에서는 실제 모바일 필수 구도 촬영 4장, 카메라 왕복 상태 보존, 72%·91% 예상치, Mock 주문, 수거 후 변경 승인, 68% 보증서까지 한 주문으로 수동 검증한다.

## 결과

2026-08-14 기준 `feature-mvp-beta-ui` 브랜치에 고객용 MVP 베타 UI를 구현했다. 17개 주요 라우트와 2개 상태 호환 alias가 독립 렌더되며, 제품 등록에서 AI 사전 분석·추천·3D 목업·신청·Mock 결제·완료 신청·디지털 ESG Passport까지 하나의 정적 데모 흐름으로 연결된다.

이번 결과물은 당시 승인된 API 계약 v1.1.0, `mock-data.json`, Supabase 스키마를 변경하지 않는 프레젠테이션 레이어다. 실제 인증·카메라·AI·3D 렌더러·결제·물류·NFC/QR 동작은 구현하지 않았고, 코드의 확장 지점에 `TODO(post-beta):`를 남겼다.

## 구현 범위

### 화면과 라우트

| 영역 | 라우트 | 구현 내용 |
|---|---|---|
| 소개·인증 | `/intro`, `/login`, `/signup` | 대상 제품, 6단계 여정, 데모 인증 폼, 약관 UI |
| 홈 | `/` | Figma 기반 모바일 홈, 주요 진입점, 진행 상태 variant |
| 등록·촬영 | `/products/new`, `/products/new/camera` | 4개 촬영 슬롯, 1~4장/6MB/JPEG·PNG·WebP 계약 안내, 카메라 UI |
| 접수·분석 | `/submissions/demo`, `/submissions/demo/ineligible`, `/submissions/demo/analysis` | 접수·보완·품질 재촬영·수동 검토·A/C 등급 결과 |
| 추천·목업 | `/submissions/demo/designs`, `/submissions/demo/designs/passport-wallet` | Figma 추천 후보, 계약 카탈로그 고지, 정적 3D 목업 상세 |
| 신청·결제 | `/orders/new`, `/checkout`, `/orders/demo/complete` | 계약 주소·동의 필드, `DEMO_CARD`, native validation, `PENDING_APPROVAL` 완료 |
| 진행·Passport | `/orders/demo`, `/certificates/demo` | 별도 완료 신청 타임라인, 조건 변경 예시, EsgCertificate 필수 필드와 여정 |
| 계정 | `/mypage` | 데모 프로필·선호 매장·비활성 계정 관리 진입점 |
| 호환 alias | `/orders`, `/certificates` | query를 보존해 `/orders/demo`, `/certificates/demo`로 redirect |

### 공용 컴포넌트

- 레이아웃: `AppShell`, `PageHeader`, `BottomNav`, `StickyActionBar`, `Section`
- UI: `Button`/`ButtonLink`, `Card`, `TextField`, `KeyValueList`, `ProgressStepper`, `SectionBand`, `StatusPanel`
- 도메인: 분석·주문 상태 패널, `RecycleGauge`, 추천 grid/card, 화면별 thin state parser
- 상태: normal, loading, empty, error, permission, limited, canceled, locked, change-request와 `reason=quality|review`

공용 색상·타이포그래피·간격·반경·그림자·모션은 `app/globals.css`의 의미 토큰으로 통합했다. 화면 CSS의 숫자 리터럴은 반응형 media query breakpoint에만 남아 있다.

## 디자인 구현

- Figma beta frame의 402×874 기준, Pretendard 계열 위계, `#222` 중심 색상, 26~32px 거터, 2px CTA 반경을 토큰화했다.
- 로그인, 회원가입, 홈, 촬영, 분석 성공/제작 어려움, 추천, 3D 목업, 주문, 완료, 진행, Passport, 마이페이지의 제공 자산을 로컬에 보존했다.
- 추천 loop는 Figma motion의 3.312942초와 -392.5px 이동을 반영했다. `prefers-reduced-motion` 및 360px 이하에서는 정지하고 수동 스크롤·1열로 전환한다.
- 28개 로컬 asset 참조를 검사했으며 누락은 0개다. 임시 Figma MCP URL과 외부 placeholder URL은 남아 있지 않다.

## 계약·안전 정합성

- 사진 0장에서는 분석 CTA가 비활성화된다.
- 이미지 품질 실패는 `IMAGE_QUALITY_INSUFFICIENT` / `RECAPTURE_REQUIRED`, 수동 검토는 `REVIEW_REQUIRED` / `PENDING` / `AWAIT_MANUAL_REVIEW`로 분리했다.
- AI가 정품·가품을 확정한다는 표현을 사용하지 않는다.
- **역사 기록 정정:** 당시 보고서는 신청 폼이 이름·전화·주소를 URL query에 싣지 않는다고 적었지만, 2026-08-14 구현은 GET query로 전달해 이 주장은 사실과 달랐다. 현재 구현은 POST와 클라이언트 주문 초안 상태로 교체했으며, 당시 동의 키와 개인정보 처리 설명은 superseded다.
- 활성 결제수단은 계약값 `DEMO_CARD` 하나이며, 필수 확인 전에는 제출되지 않는다.
- Mock 결제 직후 신청은 `PENDING_APPROVAL`로 표시한다. Passport 흐름은 다른 `COMPLETED` 프레젠테이션 신청임을 명시한다.
- Passport는 OpenAPI `EsgCertificate`의 필수 필드 12개에 대응하고, 탄소·보증서가 법적·공인 수치가 아닌 데모임을 표시한다.
- 여권 지갑 프레젠테이션 식별자는 기존 키링 Fixture ID와 충돌하지 않는다.
- OpenAPI, DB, `mock-data.json`, 패키지 의존성은 변경하지 않았다.

## 검증 결과

### 자동·정적 검사

| 검사 | 결과 |
|---|---|
| `python validate_package.py` | PASS — 19 paths, 21 operations, 82 schemas, 3 products, recapture/manual-review fixture 확인 |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — 22 static/dynamic pages 생성 |
| `git diff --check` | PASS |
| asset 참조 검사 | PASS — 28 refs, missing 0 |
| 임시/외부 placeholder URL 검사 | PASS — 0 |
| 화면 CSS raw 값 검사 | PASS — media query breakpoint 외 0 |

현재 `mcm-reborn/package.json`에는 자동 테스트 스크립트가 없으므로 `npm test`를 실행하거나 자동 테스트 통과로 기록하지 않았다.

### 브라우저 회귀

- 17개 기본 URL과 2개 alias를 402×874에서 확인: 모두 `main`과 단일 `h1`, 수평 overflow 없음.
- permission, locked, loading, empty, limited, canceled, change-request, 품질·수동 검토 등 23개 query 상태 확인.
- 320×720 대표 8개 화면: 수평 overflow 없음, 추천 1열·모션 정지.
- 1280×900 대표 8개 화면: 402px 앱 셸 중앙 배치, 수평 overflow 없음.
- 제품 등록→분석 loading→완료 결과→추천→3D 목업→신청 흐름 통과.
- 주문 필수 3개 동의와 결제 확인 native validation, 개인정보 없는 checkout 이동, 완료→완료 신청→Passport 흐름 통과.
- fresh browser console warning/error 0건.
- 추천과 Passport 화면을 브라우저 캡처로 시각 확인했으며 생성된 QA 이미지는 저장소 산출물로 추가하지 않았다.

## 알려진 제한

1. 홈 hero의 Figma raw raster가 유효한 이미지가 아니라 거의 단색 데이터로 반환되어, 정확한 `home-hero-mask.svg`와 빈 dark container만 사용했다. `HomeScreen`에 `TODO(asset):`가 남아 있다.
2. 계약 품목인 키링의 정확한 beta Figma raster가 없어 키링 탭은 빈 상태를 표시한다. 파우치·지갑 시각 후보 중 실제 상세 링크는 자산이 있는 여권 지갑에만 제공한다.
3. 카메라 캡처, 파일 보존, AI 호출, GLB/glTF viewer, 인증 저장, 결제·물류, 조건 재승인, NFC/QR 공개 검증, Passport 발급·공유는 UI 진입점만 있다.
4. Figma가 모바일 고정폭만 제공하므로 데스크톱은 402px 중심 앱 셸로 확장했다. 별도 wide-screen 정보 구조는 디자인 승인 후 추가해야 한다.

## 후속 작업 권고

1. 올바른 홈 hero 원본을 받아 `TODO(asset):`를 해소한다.
2. 회원가입/프로필, 수거 일정, 실물 검수 조건 재승인, NFC Passport 계약을 별도 이슈로 승인한다.
3. 승인 계약에 맞춰 인증·Storage·분석·신청·Mock 결제·진행 API를 연결하고 상태 전이 테스트를 추가한다.
4. 키링과 각 추천 후보의 상세 이미지·3D 자산을 확정해 계약 제품과 프레젠테이션 후보를 1:1 매핑한다.
5. Playwright 또는 동등한 브라우저 테스트를 도입해 핵심 흐름과 query 상태 회귀를 자동화한다.

## 커밋 구성

작업은 기획 정합화, Figma 분석, 화면 매트릭스, 토큰, 공용 UI, 내비게이션, asset, 화면 그룹 A/B/C, QA 보정, 개발 보고서의 독립 커밋으로 나눴다. 자세한 제품 결정은 [decision-log.md](./decision-log.md), 화면별 근거는 [screen-matrix.md](./screen-matrix.md), Figma 실측은 [design-analysis.md](./design-analysis.md)를 따른다.
