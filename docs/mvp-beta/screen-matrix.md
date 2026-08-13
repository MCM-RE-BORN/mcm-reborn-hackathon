# MVP 베타 화면 매트릭스

## 판정 기준

- **디자인 완료:** 해당 목적의 Figma frame이 있고 핵심 내용·상태가 표현됨.
- **부분:** Figma frame은 있으나 최신 기획 필드, scroll, 상태 또는 별도 단계가 빠짐.
- **없음:** 최신 와이어프레임/유저플로우에는 있으나 Figma frame이 없음.
- **충돌:** Figma의 가시 동작이나 문구가 최신 기획 또는 승인 계약과 정면 충돌함.
- **Figma대로:** 계약 충돌을 교정한 뒤 Figma visual을 기준으로 구현.
- **와이어프레임 + 디자인 스타일:** 최신 와이어프레임 구조에 `design-analysis.md`의 토큰·컴포넌트 언어를 적용.

## 전체 매칭

| 화면명 | 유저플로우 상 위치 | 와이어프레임 | Figma 디자인 | 상태 | 구현 기준 | 라우트 / 비고 |
|---|---|---|---|---|---|---|
| 서비스 소개 | 최초 실행→소개→시작 | n2, 완성 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/intro`; 공개, 가치·대상·6단계 흐름 |
| 로그인 | 비회원 인증 | n6, 완성 | `177:1034` | 디자인 완료 | Figma대로 | `/login`; 데모 폼, 실제 인증 제외 |
| 회원가입 | 로그인→가입→홈 | n7, 완성 | `177:1087` | 부분 | Figma대로 | `/signup`; 계약 없는 저장 동작 제외, 약관 UI 포함 |
| 홈 | 인증/게스트→주요 진입 | n11, 완성 | `177:94` | 부분 | Figma대로 | `/`; 기획의 안내·상태 요약을 추가, hero asset 확인 필요 |
| 제품 등록·촬영 업로드 | 홈→제품 사진/정보 제출 | n13, 완성 | `177:192` | 부분 | 와이어프레임 + 디자인 스타일 | `/products/new`; 계약의 1~4개/6MB/WebP 적용 |
| 카메라 촬영 | 등록 슬롯→촬영→복귀 | n13 내부 동작 | `177:264` | 디자인 완료 | Figma대로 | `/products/new/camera`; 실제 camera 미구현, 진입점만 |
| 접수 현황 | 제출→접수/분석/보완/완료 | n16, 완성 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/submissions/demo`; 상태 variant와 보완 재제출 |
| 접수 불가·품질 미달 | 정품 검토/품질 분기 | n21 target 누락 | 분석 실패 `177:572`는 다른 의미 | 없음 | 와이어프레임 + 디자인 스타일 | `/submissions/demo/ineligible`; 품질·수동검토를 구분 |
| AI 분석 결과 성공 | 분석 완료→추천 | n22, 완성 | `177:514` | 충돌 | Figma대로 | `/submissions/demo/analysis`; `정품 확인됨`을 NOT_EVALUATED로 교정 |
| AI 분석 결과 제작 어려움 | 결과→재등록/홈 | n22 상태로 부분 | `177:572` | 디자인 완료 | Figma대로 | `/submissions/demo/analysis?state=limited`; C등급 상태 variant |
| 디자인 추천 | 분석→후보 비교→선택 | n25, 완성 | `177:324`, `177:389` | 충돌 | 와이어프레임 + 디자인 스타일 | `/submissions/demo/designs`; 계약 3종+Figma visual 분리, 추천 0건 상태 |
| 3D 목업 확인 | 후보 선택→목업→신청 | n28, 완성 | `177:461` | 부분 | Figma대로 | `/submissions/demo/designs/passport-wallet`; PNG+3D 진입점만 |
| 주문 신청·수거 정보 | 목업 선택→수거 정보 | n32, 완성 | `177:779` | 부분 | 와이어프레임 + 디자인 스타일 | `/orders/new`; Figma 긴 form을 scroll+sticky CTA로 재구성 |
| 주문 확인·가상 결제 | 주문 정보→결제 | n34, 완성 | `177:779`에 합쳐짐 | 부분 | 와이어프레임 + 디자인 스타일 | `/checkout`; 별도 review 단계, 실제 결제 제외 |
| 주문 완료 | 결제 완료→신청번호 | n37, 완성 | `177:878` | 디자인 완료 | Figma대로 | `/orders/demo/complete`; 데모/Mock 표기 |
| 주문 진행 조회·신청 내역 | 완료→제작/배송 조회 | n39, 완성 | `177:621` | 부분 | Figma대로 | `/orders/demo`; 계약 상태를 6단계 presentation으로 매핑 |
| 조건 변경 승인/거절 | 실물 검수 변경→결정 | n42 target 누락 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders/demo?panel=change-request`; 진입점만, 처리 API 없음 |
| 주문 취소 완료 | 조건 거절→취소 | n46 전체 누락 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders/demo?state=canceled`; 독립 페이지 대신 상태 variant |
| 주문 없음 | 진행 조회 빈 상태 | n39 공통상태로 암시 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders?state=empty`; `StatusPanel` 사용 |
| 디지털 ESG 보증서·Passport | 완료/NFC→보증서 | n47, 완성 | `177:924` | 충돌 | Figma대로 | `/certificates/demo`; ESG+Passport 통합, 법적 효력 없는 데모 |
| 보증서 없음/발급 중 | 완료 전 보증서 접근 | n47 공통상태로 암시 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/certificates?state=empty`; locked/loading variant |
| 마이페이지 | 홈 하단 nav→프로필 | 최신 flow에는 명시 없음 | `177:714` | 충돌 | Figma대로 | `/mypage`; 이름/휴대폰 라벨 오류 교정, 실제 설정 저장 제외 |

## 상태와 구현 원칙

### 디자인 완료 화면

로그인, 카메라 촬영, 분석 결과 제작 어려움, 주문 완료는 구조를 Figma visual에 맞추되 device chrome과 절대좌표는 제거한다.

### 부분 화면

- 회원가입: UI는 구현하되 계정 저장·중복 이메일 API는 제외.
- 홈: Figma visual에 최신 기획의 서비스 범위·데모 상태 진입점을 더한다.
- 제품 등록: Figma의 4개 슬롯에 와이어프레임의 제품 정보와 계약 검증을 결합한다.
- 3D 목업: Figma PNG asset을 사용하고 실제 3D는 진입점만 둔다.
- 주문·진행: Figma의 겹침/overflow를 실제 scroll과 sticky CTA로 고친다.

### 충돌 화면

- 분석 성공: 정품 확정 문구를 승인 계약의 신호 언어로 바꾼다.
- 추천: 최신 기획 4종과 기존 계약 3종을 혼합하지 않고 presentation 후보와 계약 데이터를 구분한다.
- 보증서: ESG와 NFC Passport를 한 상세에 통합하고 QR/NFC는 mock 진입점으로 표시한다.
- 마이페이지: Figma label mismatch를 교정하며 최신 핵심 flow 밖의 보조 화면으로 취급한다.

## 라우트 완료 목록

P6 완료 시 아래 실제 URL이 모두 독립 렌더되어야 한다.

```text
/
/intro
/login
/signup
/products/new
/products/new/camera
/submissions/demo
/submissions/demo/ineligible
/submissions/demo/analysis
/submissions/demo/designs
/submissions/demo/designs/passport-wallet
/orders/new
/checkout
/orders/demo/complete
/orders/demo
/certificates/demo
/mypage
```

query parameter 기반 상태는 동일 페이지에서 정상·loading·empty·error·permission·limited/canceled 변형을 제공한다. 실제 인증·AI·카메라·3D·결제·NFC 동작은 `TODO(post-beta):` 확장 지점으로 남긴다.

## 누락 감사

- 최신 와이어프레임의 14개 화면: 모두 매칭됨.
- 유저플로우에만 있는 n21/n42/n46: 모두 상태/라우트로 보완됨.
- Figma에만 있는 촬영 화면·마이페이지: 모두 보조 라우트로 분류됨.
- 최신 기획의 AI·카메라·3D·결제·NFC: 실제 동작 제외, UI 진입점 매칭됨.
- 공통 loading/empty/error/permission: `StatusPanel` variant로 전 화면에서 재사용하도록 매칭됨.
