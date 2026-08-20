# MVP 베타 화면 매트릭스

> 2026-08-18 화면의 최종 시각 기준은 Figma `디자인` 파일의 `최종 디자인` 페이지(`228:391`)다. 그중 홈·공통 탐색·신청 내역은 최신 사용자 지정 노드 `220:63`, `220:65`, `222:81`, `261:63`을 우선한다. 제품 수치·필드·상태 순서가 Figma와 충돌하면 [`../MVP_DEMO_CANONICAL.md`](../MVP_DEMO_CANONICAL.md)를 우선하고 시각 위계·간격·자산만 Figma를 따른다. 이전의 정적 진입점·1~4장/6MB/WebP·주문 전 수동 검토·별도 완료 주문·4탭·`/orders` redirect 설명은 **superseded/historical**이다.

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
| 서비스 소개 | 최초 실행→소개→시작 | n2, 완성 | `228:769` 시작 화면 | 부분 | Figma대로 | `/`는 이미지 준비 후 최소 1초 뒤 자동 이동하는 풀블리드 시작·로그인 초기 로딩 화면, `/intro`는 `새로운 여정`·6단계·면책·하단 스크롤 안내를 제공 |
| 로그인 | 비회원 인증 | n6, 완성 | `228:1457` | 디자인 완료 | Figma대로 | `/login`; CUSTOMER 인증 성공 뒤 `/` 초기 로딩을 거쳐 `/home` 이동 |
| 회원가입 | 로그인→가입→홈 | n7, 완성 | `228:1510` | 부분 | Figma대로 | `/signup`; 계약 없는 저장 동작 제외, 약관 UI 포함 |
| 홈 | 인증/게스트→주요 진입 | n11, 완성 | `220:63`; 영상 그룹 `220:65`; CTA `222:81` | 디자인 완료 | Figma대로 | `/home`; 실제 hero 영상 재생, 원본의 모바일 OS 상태바 crop, `상품 진단하기` 공통 CTA, `신청 내역`·`홈`·`마이페이지` 3탭 내비게이션 |
| 제품 등록·촬영 업로드 | 홈→제품 사진/정보 제출 | n13, 완성 | `228:651` | 부분 | 와이어프레임 + 디자인 스타일 | `/products/new`; 정면·후면·상단·하단·좌측면·우측면·일련번호 필수 7슬롯, JPG/PNG 7장·10MB, 제품정보 세션 보존을 결합 |
| 카메라 촬영 | 등록 슬롯→촬영→복귀 | n13 내부 동작 | `228:722` | 디자인 완료 | Figma대로 | `/products/new/camera`; 후면 카메라, 미리보기·재촬영·사용, 파일 폴백 |
| 접수 현황 | 제출→접수/분석/보완/완료 | n16, 완성 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/submissions/demo`; 최초 `SUB-RB-20260817-0001`은 1~2초 Fixture 분석을 거치며 완료 후 재진입은 `/submissions/demo/analysis`로 즉시 이동 |
| 접수 불가·품질 미달 | AI 사전 적합/품질 분기 | n21 target 누락 | 분석 제한 `228:1037`은 일부 의미만 일치 | 부분 | 와이어프레임 + 디자인 스타일 | `/submissions/demo/ineligible`; 품질 미달과 명백한 비대상을 구분하며 가품 확정 금지 |
| AI 분석 결과 성공 | 분석 완료→추천 | n22, 완성 | `228:979` | 충돌 | Figma대로 | `/submissions/demo/analysis`; 예상 재활용률 72%, 정품 사전 적합도 예상 91%, 실물 검수 후 변경 고지 |
| AI 분석 결과 제작 어려움 | 결과→재등록/홈 | n22 상태로 부분 | `228:1037` | 디자인 완료 | Figma대로 | `/submissions/demo/analysis?state=limited`; C등급 상태 variant |
| 디자인 추천 | 분석→제품군 비교→선택 | n25, 완성 | `228:782` | 부분 | Figma대로 | `/submissions/demo/designs`; 트래블·지갑·파우치·키링 탭, 선택한 상품은 여권 지갑 목업 상세로 진입, 고정 목업 CTA 없음 |
| 3D 목업 확인 | 후보 선택→목업→신청 | n28, 완성 | `228:926` | 부분 | Figma대로 | `/submissions/demo/designs/passport-wallet`; 정적 다각도 이미지 또는 데모 회전·확대, 제작 범위는 예상 표현 |
| 주문 신청·수거 정보 | 목업 선택→수거 정보 | n32, 완성 | `228:1253` | 부분 | 와이어프레임 + 디자인 스타일 | `/orders/new`; 수거 정보, 최초 예상 180,000원·수거 무료, 실물 검수 후 변경 고지 |
| 주문 확인·가상 결제 | 주문 정보→결제 | n34, 완성 | `228:1253`에 합쳐짐 | 부분 | 와이어프레임 + 디자인 스타일 | `/checkout`; Mock 결제 뒤 `ORDER_PLACED`, 주문 전 장인 승인 없음 |
| 주문 완료 | 결제 완료→주문번호 | n37, 완성 | `228:1352` | 디자인 완료 | Figma대로 | `/orders/demo/complete`; `RB-20260817-0001`, 다음 단계 수거 안내 |
| 신청 내역 목록 | 하단 nav→신청/진단 탭→항목 선택 | n39 진입을 목록으로 보완 | `220:63`의 `신청 내역` nav | 부분 | 와이어프레임 + 디자인 스타일 | `/orders`; 최상위 화면이라 뒤로가기 없음, 로그인 초기 메모리 캐시를 즉시 표시하고 진입 시 변경 응답만 갱신, `신청 내역`·`진단 내역` 탭 분리, 완료 신청은 ESG 인증서 바로가기 표시 |
| 신청 내역 상세 | 상품 선택→수거/검수/제작/배송 | n39, 완성 | `261:63` | 디자인 완료 | Figma대로 | `/orders/demo`; 한 주문의 변경 전후 조건·진행 상태·배송 정보, 인접 점 사이 연결선 유지 |
| 조건 변경 승인/거절 | 주문 후 실물 검수 변경→결정 | n42 target 누락 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders/demo?panel=change-request`; 72→68%, 180,000→195,000원, 4~5주, 승인 경로 실제 데모 상태 반영 |
| 주문 취소 완료 | 조건 거절→취소 | n46 전체 누락 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders/demo?state=canceled`; 독립 페이지 대신 상태 variant |
| 신청 내역 없음 | 신청 내역 목록 빈 상태 | n39 공통상태로 암시 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/orders?state=empty`; `StatusPanel` 사용 |
| 디지털 ESG 보증서·Passport | 완료/NFC→보증서 | n47, 완성 | `228:1398` | 충돌 | Figma대로 | `/certificates/demo`; `COMPLETED` 뒤 `ESG-RB-20260817-0001`, 68%, 3.43kg CO2e, 법적 효력 없는 데모 |
| 보증서 없음/발급 중 | 완료 전 보증서 접근 | n47 공통상태로 암시 | 없음 | 없음 | 와이어프레임 + 디자인 스타일 | `/certificates?state=empty`; locked/loading variant |
| 마이페이지 | 공통 하단 nav→프로필 | 최신 사용자 지시로 명시 | `228:1176`; nav `220:63` | 디자인 완료 | Figma대로 | `/mypage`; 최상위 화면이라 뒤로가기 없음, 로그인 초기 메모리 캐시를 즉시 표시, 이름/휴대폰 라벨 오류 교정 |
| 관리자·장인 운영 콘솔 | 신청 목록→상세→다음 단계 | 최신 사용자 지시 | 없음 | 없음 | 디자인 토큰 재사용 | `/operations`, `/operations/[applicationId]`; OPERATOR 인증 기반 실제 v2 API 목록·상세·단계별 담당 표시·허용 상태 진행 |

## 상태와 구현 원칙

### 디자인 완료 화면

로그인, 카메라 촬영, 분석 결과 제작 어려움, 주문 완료는 구조를 Figma visual에 맞추되 device chrome과 절대좌표는 제거한다.

### 부분 화면

- 회원가입: UI는 구현하되 계정 저장·중복 이메일 API는 제외.
- 홈: `220:65`의 실제 영상을 muted·loop·inline으로 재생하고 원본의 시계·카메라·통신·배터리 OS 상태바는 crop한다. `222:81`의 `상품 진단하기` CTA를 적용하며 상품 진단과 인증서 CTA는 공통 ActionButton을 사용한다.
- 제품 등록: 7개 슬롯을 정면·후면·상단·하단·좌측면·우측면·일련번호로 두고 모두 필수인 10MB/JPG·PNG 규칙과 제품 정보 보존을 결합한다.
- 3D 목업: Figma PNG asset 또는 정적 다각도 프레임을 사용하고 회전·확대 조작을 시연한다.
- 신청 내역: `/orders` 목록에서 상품을 고른 뒤 `/orders/demo` 상세로 이동한다. 상세의 진행 상태와 배송 정보는 점만 나열하지 않고 인접 점 사이 선을 함께 표시하며, Figma의 겹침/overflow는 실제 scroll과 sticky CTA로 고친다.

### 충돌 화면

- 분석 성공: 정품 확정 문구를 `정품 사전 적합도 예상 91% — 정품 확정 아님`으로 바꾼다.
- 추천: 중앙 시나리오의 RE:BORN 여권지갑을 주문까지 이어지는 골든 후보로 고정한다.
- 보증서: ESG와 NFC Passport를 한 상세에 통합하고 QR/NFC는 mock 진입점으로 표시한다.
- 마이페이지: Figma label mismatch를 교정하며 최신 핵심 flow 밖의 보조 화면으로 취급한다.

## 라우트 완료 목록

2026-08-18 코드 감사 기준 아래 URL이 독립 렌더된다. `/`와 `/intro`는 서비스 소개, `/home`은 홈이다.

```text
/
/intro
/home
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
/orders
/orders/demo
/certificates/demo
/mypage
/operations
/operations/[applicationId]
```

query parameter 또는 중앙 Fixture 기반 상태는 동일 페이지에서 정상·loading·empty·error·permission·limited/canceled/change-request 변형을 제공한다. 카메라는 실제 브라우저 촬영과 파일 폴백을 제공하고, AI·3D·결제·물류·검수·NFC는 재현 가능한 데모 동작으로 완주한다.

## 누락 감사

- 최신 와이어프레임의 14개 화면: 모두 매칭됨.
- 유저플로우에만 있는 n21/n42/n46: 모두 상태/라우트로 보완됨.
- Figma에만 있는 촬영 화면·마이페이지: 모두 보조 라우트로 분류됨.
- 최신 기획의 카메라: 실제 촬영·미리보기·재촬영·파일 폴백을 기준으로 매칭됨.
- 최신 공통 탐색: `신청 내역`·`홈`·`마이페이지` 3탭과 `/orders` 목록→`/orders/demo` 상세를 기준으로 매칭됨.
- 홈 영상·CTA: 실제 영상 재생과 `상품 진단하기` CTA를 최신 지정 노드에 매칭하고 인증서 CTA와 컴포넌트를 통일함.
- AI·3D·결제·물류·검수·NFC: 중앙 Fixture와 정적 자산으로 골든 흐름을 완주하도록 매칭됨.
- 공통 loading/empty/error/permission: `StatusPanel` variant로 전 화면에서 재사용하도록 매칭됨.
