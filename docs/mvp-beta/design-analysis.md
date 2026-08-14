# Figma beta 디자인 분석

## 분석 범위와 방법

- 파일: `h1LbFck3xMVurMyWNIv8NM`
- 기준 섹션: `beta` (`177:93`)
- 기준 프레임: 402×874 모바일 화면
- 방식: 전체 섹션 메타데이터로 구조만 파악한 뒤 각 화면 프레임을 `get_design_context`로 분할 조회했다. 추천 화면은 motion context, 대표 화면은 asset export inventory까지 확인했다.
- Code Connect, 컴포넌트 문서 링크, design annotation은 반환되지 않았다.
- Figma Variables/Styles 검색과 node variable 조회 결과는 비어 있다. 이 파일은 이름 있는 토큰 대신 raw hex·픽셀 값을 직접 사용한다.

## 1. Section / 페이지 구조

`beta`는 하나의 큰 Section 안에 402×874 모바일 프레임을 가로로 배치한 구조다. 대부분 루트 프레임은 흰 배경, radius 30px, overflow clip이며 실제 앱 화면보다 iPhone 목업 프레임에 가깝다.

| 영역 | 화면 | Node | 완성도·특징 |
|---|---|---:|---|
| 인증 | 로그인 | `177:1034` | 완성, 고정 배치 |
| 인증 | 회원가입 | `177:1087` | 완성, 고정 배치 |
| 홈 | 메인 홈 | `177:94` | 완성, hero+하단 nav |
| 등록 | 촬영 업로드 | `177:192` | 완성, 4개 촬영 슬롯 |
| 등록 | 촬영 화면 | `177:264` | 완성, 카메라 진입 UI |
| 분석 | 성공 결과 | `177:514` | 완성, 72% A등급 |
| 분석 | 제작 어려움 | `177:572` | 완성, 18% C등급 |
| 추천 | 추천 디자인 수정 | `177:324` | 완성, 4개 탭·3개 이미지·모션 |
| 추천 | 추천 디자인 | `177:389` | 완성, 3개 탭·8개 이미지·모션 |
| 상세 | 3D 목업 미리보기 | `177:461` | 완성, 긴 스크롤·4개 주요 이미지 |
| 신청 | 업사이클링 신청 | `177:779` | 부분, 1328px 본문과 CTA가 중첩 |
| 신청 | 신청 완료 | `177:878` | 완성, 확인 상태 |
| 진행 | 신청 내역 | `177:621` | 부분, 긴 본문이나 scroll 미정의 |
| 계정 | 마이페이지 | `177:714` | 완성, 프로필 라벨 오류 1건 |
| 보증서 | 디지털 ESG 보증서 | `177:924` | 완성, hidden placeholder 1개 제외 |
| 보조 | 시작 | `177:311` | 빈 프레임 |
| 이전안 | 메인 홈 | `177:147` | 중복 이전안 |

Figma에 없는 최신 기획 화면은 서비스 소개, 접수 현황/보완, 접수 불가, 주문 확인·결제의 별도 단계, 조건 변경 승인·거절, 주문 없음·보증서 없음 상태다. 이들은 와이어프레임 구조와 아래 디자인 언어를 결합한다.

## 2. 사용 컴포넌트 인벤토리

Figma 레이어는 화면별 Rectangle/Frame 복제가 많아 코드에서는 다음 의미 단위로 재구성한다.

| 컴포넌트 | variant / state | 사용 화면 |
|---|---|---|
| `AppShell` | default, immersive | 전체; 촬영은 immersive |
| `PageHeader` | back+title, back-only, title+description | 인증, 등록, 결과, 추천, 신청, 내역, 보증서 |
| `PrimaryButton` | full, compact, sticky | 로그인, 홈, 등록, 결과, 추천, 신청, 완료, 보증서 |
| `TextLink` | primary, secondary, destructive | 로그인, 결과 실패, 목업, 마이페이지, 보증서 |
| `TextField` | text, password, phone, serial, address | 로그인, 회원가입, 촬영 업로드, 신청 |
| `SectionBand` | 10px neutral | 신청, 신청 내역 |
| `KeyValueList` | default, emphasized-total | 분석 결과, 신청 요약, 배송·결제, 보증서 |
| `BottomNav` | home, orders, profile | 홈 |
| `CaptureSlot` | hero, half, serial, completed | 촬영 업로드 |
| `CameraGuide` | outline, corners, shutter | 촬영 화면 |
| `RecycleGauge` | success, failure | 분석 결과 2종 |
| `ProductTabs` | 3-tab, 4-tab | 추천 2종 |
| `ProductCard` | image+name | 추천 |
| `ProductGallery` | hero, detail | 3D 목업 |
| `PaymentMethodGrid` | default, selected | 신청 |
| `ProgressStepper` | current index 0~5 | 신청 내역 |
| `StatusPanel` | loading, empty, error, permission, success | Figma 누락 상태 보완 |
| `CertificateInfo` | issued, locked/empty | ESG 보증서·빈 상태 |

중복·유사 변형은 다음처럼 통합한다.

- 높이 56px CTA와 홈의 36px CTA는 `full`/`compact` variant다.
- 분석 결과 성공·실패는 같은 gauge와 결과 레이아웃의 tone/content variant다.
- 추천 `177:324`와 `177:389`는 동일 list/grid의 탭 수·카드 수·설명 타이포 변형이다.
- 신청/배송/결제/보증서의 좌우 label-value 행은 하나의 `KeyValueList`로 합친다.
- iOS 상태바·Dynamic Island는 디자인 검토용 device chrome이며 실제 웹 UI에는 렌더하지 않는다.

## 3. Auto Layout 구조

### Figma 실제 상태

- 화면 대부분이 절대좌표 기반이며 의미 있는 Auto Layout 또는 responsive constraint가 없다.
- 공통 좌표는 좌우 `x=26~30`, 본문 폭 `341~350`, 하단 CTA `y=769~795`다.
- 신청 본문은 1328px, 신청 내역 본문은 834px인데 루트 overflow clip 안에 들어 있고 스크롤 정의가 없다.
- 추천 화면은 174px header, 1195px list, 103px bottom overlay의 3층 구조다.
- 3D 목업만 header 112px + 명시적 scroll viewport 762px + inner 1500px 구조가 드러난다.

### 코드 재해석

- `AppShell`: column, `min-height: 100dvh`, content flex-1.
- `PageHeader`: column 또는 row, 좌우 26~30px, top safe area 이후 배치.
- 일반 본문: column, 24~32px section gap.
- form: column 27~30px label-group cadence, field 내부 10px horizontal padding.
- 신청 payment methods: 2-column grid, 12px column gap, 13px row gap.
- 추천 product grid: 2-column grid, 5px gap, 행 pitch 244px를 이미지 비율과 text gap으로 재구성.
- scroll 화면: content bottom padding을 sticky CTA 높이+safe area 이상 확보.
- sticky footer: 흰 배경, 26~30px horizontal padding, 22~24px bottom inset.

## 4. Spacing

### 실측 패턴

| 역할 | 실측값 | 제안 토큰 |
|---|---:|---|
| micro | 4~5px | `--space-1: 4px` |
| icon/text | 6px | `--space-1-5: 6px` |
| small | 8px | `--space-2: 8px` |
| control gap | 12~14px | `--space-3: 12px`, `--space-3-5: 14px` |
| section inner | 16~18px | `--space-4: 16px` |
| content gap | 20px | `--space-5: 20px` |
| screen gutter | 26~30px | `--space-page: 26px`, desktop 32px |
| field group pitch | 29~30px | `--space-7: 28px` 또는 layout gap |
| result row pitch | 33px | 12px padding+20px line-height |
| section cadence | 40~50px | content 기반으로 계산 |

### 고정 크기

- full CTA: 350×56 at 402px viewport → `width: 100%`, `min-height: 56px`.
- input: 38/40/48px variants; 폼 기본은 48px, compact는 40px.
- 터치 대상은 시각 높이가 작더라도 최소 44px hit area를 확보한다.
- section band: 10px.
- 홈 bottom nav: 356×61, radius 38.5px.
- 분석 gauge: 229.139px base + 253px arc bounding.
- 추천 이미지: 168×182, 카드 row pitch 244px.

## 5. Typography

본문 주서체는 Pretendard다. iOS chrome의 SF Pro Display는 웹 콘텐츠에서 제외한다.

| 의미 | Figma 실측 | 제안 토큰 |
|---|---|---|
| display/result number | Pretendard Bold 40 / 24.906 | `--text-display: 40px/1` |
| hero/complete title | Bold 또는 SemiBold 24 / normal~20 | `--text-title-lg: 24px/1.25` |
| page title | SemiBold 18 / 20 | `--text-title: 18px/1.35` |
| section title | SemiBold 15 / 20 | `--text-heading: 15px/20px` |
| primary body | Regular/Medium 13 / 20 | `--text-body: 13px/20px` |
| label/value | Light/SemiBold 13 / 20 | body + weight token |
| compact/meta | Regular/Medium 12 / 20 | `--text-caption: 12px/20px` |
| long description | Light 13 / 25~28 | `--text-reading: 13px/1.9` |

사용 weight는 300, 400, 500, 600, 700이다. 근접한 15/16px CTA는 15px로, 11/12px meta는 가독성을 위해 12px로 통합한다. 제목에서 line-height 20px가 font-size보다 작은 경우는 clipping 위험이 있어 1.25~1.35 비율로 보정한다.

## 6. Colors

### 실측과 통합 팔레트

| 의미 | 실측 | 통합 토큰 |
|---|---|---|
| canvas | `#FFFFFF` | `--color-canvas` |
| ink/CTA | `#222222`, 일부 `#000000` | `--color-ink: #222222` |
| secondary text | `#8C8C8C`, link `#858585` | `--color-muted: #8C8C8C` |
| tertiary product text | `#303030` | ink 계열 `--color-ink-soft` |
| surface | `#F7F7F7` | `--color-surface` |
| divider | `#EDEDED` | `--color-divider` |
| nav glass | `rgba(217,217,217,.20)` | `--color-nav-surface` |
| disabled/placeholder | muted + opacity .4 | `--color-placeholder` |
| success | 주로 ink/outline | `--color-success`는 ink 기반 |
| failure gauge | SVG의 deep red, 화면상 약 `#B90F12` | export asset 사용; semantic fallback `--color-danger` |

근접 중복은 `decision-log.md` D-008에 따라 의미 기반 토큰으로 통합한다. Figma의 red arc는 정확한 export SVG를 우선하며 임의 색 재현을 피한다.

## 7. Variables / Styles

- `get_variable_defs(177:93)` 결과: `{}`.
- design system 검색 결과: variables `[]`, styles `[]`.
- Code Connect 결과 없음.
- 따라서 Figma에 정의된 이름 있는 color/type/spacing variable과 실제 사용값의 차이를 계산할 수 없으며, 실제 사용값 전부가 raw property다.
- P5에서는 CSS custom properties를 단일 SSOT로 만들고 Tailwind `@theme inline`에 semantic alias를 연결한다.
- 화면 컴포넌트에는 raw hex, font-size, spacing, radius를 직접 쓰지 않는다.

## 8. 이미지·아이콘 asset 목록

Figma asset URL은 약 7일 후 만료되므로 구현에 쓰는 정확한 바이트를 `public/assets/mvp-beta/`에 저장한다. 새로 그린 SVG나 임의 placeholder는 사용하지 않는다.

| asset | 화면/역할 | 타입 | export | 처리 |
|---|---|---|---|---|
| `6c48a980-... 1` hero | 메인 홈 | PNG fill | 가능, raw 2개 반환 | 정확한 image layer 재추출 필요; 현재 frame raw 중 하나는 검은 raster로 확인됨 |
| MCM logo `image 34` | 로그인, ESG hero 계열 | PNG | 가능 | 정확한 node asset 저장 |
| `image 30` | 촬영 카메라 배경 | PNG | 가능, 1024×1907 원본 확인 | 저장해 focal crop 적용 |
| product catalog images | 추천 2종 | PNG | 가능; 3개/8개 rendered, subtree 3/16 raw | 실제 사용 후보만 저장 |
| passport wallet hero/gallery | 3D 목업 | PNG | 가능; 4개 rendered, subtree 14 raw | hero+3 detail 저장 |
| order product thumbnail | 신청 내역 | PNG | 가능 | 저장 |
| ESG brand image | 보증서 | PNG | 가능 | 저장 |
| back arrow | 여러 화면 | SVG | 가능 | exact SVG 저장 또는 동일 export 재사용 |
| bottom nav icons | 홈 | SVG | 가능 | exact SVG 저장 |
| capture corner/barcode/caret | 촬영 업로드 | SVG | 가능 | exact SVG 저장 |
| camera outline/shutter | 촬영 화면 | SVG | 가능 | exact SVG 저장 |
| gauge arcs/dividers | 분석 결과 | SVG | 가능 | 특히 failure arc exact export 저장 |
| check circle | 신청 완료 | SVG | 가능 | 저장 |
| progress dots/connectors | 신청 내역 | SVG | 가능 | CSS 데이터 기반 stepper로 대체 가능하나 glyph 재작성 금지 원칙상 단순 원/선은 CSS geometry 사용 |
| bookmark/password mask | 마이페이지 | SVG | 가능 | exact SVG 저장 |
| iOS status/dynamic island | 전체 | SVG/symbol | 가능 | 웹 콘텐츠에서는 의도적으로 미사용 |

### 누락·주의

- 홈 hero frame에서 반환된 두 raw PNG가 시각 검사상 거의 완전한 검정 이미지였다. exact image fill layer 재추출에 실패하면 해당 위치는 436×546 빈 dark container와 `TODO(asset): home hero`로 남긴다.
- Figma에는 실제 GLB/glTF가 없고 목업 PNG만 있다. 3D 영역은 PNG와 `TODO(post-beta): interactive 3D viewer`로 구현한다.
- Figma asset과 기존 계약의 3종 카탈로그가 다르므로 시각 asset을 API 데이터라고 주장하지 않는다.

## 9. Responsive 구현 고려사항

### breakpoint 전략

- mobile: 320~767px, full viewport, root radius 0.
- desktop: 768px 이상, 앱 shell을 중앙 정렬하되 화면 성격에 따라 `max-width: 480px` 단일 컬럼 또는 `max-width: 1120px` 2-column 보조 panel을 허용한다.
- Figma 402px에서는 좌우 26px 거터와 350px content width를 유지한다.

### 주요 화면 규칙

- 홈 hero는 고정 pixel scale이 아니라 `cover`와 focal position으로 bleed를 유지한다. bottom nav는 safe-area 위에 고정한다.
- 촬영 슬롯과 폼은 `calc(100% - 52px)`, half slot은 `(100% - 14px)/2`로 유동화한다.
- 촬영 카메라의 배경은 402×874 기준 약 157% width/135% height 확대와 focal crop을 비율화한다.
- gauge는 402px에서 229px, 더 좁은 화면에서는 `clamp()`로 축소한다.
- 추천 grid는 두 열을 유지하되 카드 width를 `(100% - gutter*2 - 5px)/2`로 계산한다. 320px 이하 텍스트 충돌 시 한 열을 허용한다.
- 추천의 3.312942초 무한 y-scroll 모션은 `prefers-reduced-motion`에서 멈추고 수동 스크롤 목록을 제공한다.
- 3D 목업은 header를 제외한 `calc(100dvh - header)` scroll area와 CTA 높이 이상의 bottom padding을 둔다.
- 신청·신청 내역은 반드시 세로 scroll로 만들고 CTA는 sticky footer로 분리한다.
- 상품명·주소·금액·인증번호의 Figma `nowrap`을 그대로 사용하지 않고 wrap/ellipsis와 min-width 0을 적용한다.
- 마이페이지 하단 actions는 절대 y 대신 flex `margin-top:auto`와 safe-area로 배치한다.
- text link의 시각 높이와 무관하게 최소 44×44px hit target을 제공한다.

## 디자인 QA 결정

- 마이페이지에서 `휴대폰` 라벨 옆에 이름이 배치되고 다음 행의 전화번호 라벨이 빠진 오류는 `이름 / 김하냥`, `휴대폰 / 010-1234-5678`로 교정한다.
- ESG CTA 레이어 이름은 `상품 진단 시작하기`지만 가시 컨텍스트는 `인증서 발급하기`다. 가시 디자인을 따른다.
- Figma의 `정품 여부 확인됨`은 계약과 충돌하므로 `정품 신호: 별도 판정 없음`으로 교정한다.
- 30px device corner와 iOS status bar는 목업 표현이며 실제 웹 페이지 chrome에서는 제거한다.
