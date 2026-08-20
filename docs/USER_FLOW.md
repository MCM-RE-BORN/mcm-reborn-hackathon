# MVP 사용자 흐름

> 2026-08-17 현재 흐름. 이전의 `REVIEW_REQUIRED` 주문 차단과 `PENDING_APPROVAL → APPROVED` 운영자 선승인 흐름은 **superseded/historical**이다. 제품 의미와 중앙 시나리오는 [`MVP_DEMO_CANONICAL.md`](./MVP_DEMO_CANONICAL.md), 정확한 요청·응답은 `openapi.yaml`을 따른다.

현행 웹 진입은 서비스 소개 `/` 또는 `/intro`에서 시작하고 홈은 `/home`이다. `/` 시작 화면은 대표 이미지가 준비된 뒤 최소 1초 후 `/intro`로 자동 이동한다. 고객 로그인 성공 직후에는 같은 시작 화면에서 프로필·신청·진단을 초기 로딩한 뒤 `/home`으로 이동한다. 고객 식별자·신청·분석·보증서 화면은 인증 세션으로 v2 API를 호출하며, API가 반환한 상태·빈 결과·오류를 그대로 표시한다. 분석 서버가 `DEMO_FIXTURE` 모드일 때만 재현 가능한 예상치를 사용한다. 실제 CUSTOMER/OPERATOR 자격증명으로 전체 원격 여정을 완주하는 검증은 staging에서 진행한다.

공통 하단 내비게이션은 `신청 내역`(`/orders`)·`홈`(`/home`)·`마이페이지`(`/mypage`) 3개다. 사용자 표기는 `진행조회`가 아니라 `신청 내역`이며, `/orders` 내부의 `신청 내역`·`진단 내역` 탭에서 주문과 과거 AI 분석을 구분해 확인한다. 진단 항목은 같은 분석 상세로, 신청 상품은 `/orders/demo` 상세로 이동한다.

## 고객 골든 흐름

1. `/`의 1초 시작 화면에서 자동으로 상세 소개로 이동하고, `새로운 여정`과 6단계 안내를 확인한 뒤 고객으로 로그인하거나 `먼저 둘러보기`로 홈에 이동한다. 로그인하면 같은 시작 화면에서 초기 고객 데이터가 준비된 뒤 홈의 실제 hero 영상과 `상품 진단하기` CTA를 확인한다.
2. 제품 등록에서 MCM 모노그램 백팩의 정면·후면·상단·하단·좌측면·우측면 6면과 일련번호 사진을 모바일 카메라 또는 파일 선택으로 각각 1장씩 모두 등록한다.
3. 제품 카테고리, 구매 연도 2019, 주요 사용 기간 5년 이상, 희망 제품 `RE:BORN 여권지갑`을 입력한다. 시리얼과 상태 메모는 선택이다.
4. `AI 분석 접수하기`를 누르면 접수 `SUB-RB-20260817-0001`이 생성되고 `SUBMITTED → AI_ANALYZING`을 짧게 보여 준다.
5. 중앙 Fixture 또는 재현 가능한 예상 분석으로 상태·손상·오염, 예상 재활용 가능률 72%, 정품 사전 적합도 예상 91%를 확인한다.
6. 91%는 주문 적합 신호이며 정품 확정이 아니라는 안내와, 제작 조건이 주문 후 실물 검수에서 변경될 수 있다는 안내를 확인한다.
7. 추천 화면에서 `트래블·지갑·파우치·키링` 제품군을 전환하고, `여권 지갑`을 선택해 목업을 회전·확대하거나 정적 다각도 이미지로 확인한다.
8. 수거 주소·희망 일정·연락처와 동의를 입력하고 최초 예상 제작비 180,000원, 수거 무료 조건을 확인한다.
9. Mock 결제를 완료해 주문 `RB-20260817-0001`을 생성하고 `ORDER_PLACED`를 확인한다.
10. 하단 `신청 내역`으로 `/orders`를 열고 내부 탭을 전환해 AI 진단 결과를 다시 확인하거나 `RE:BORN 여권지갑` 신청 상품을 선택해 `/orders/demo` 상세로 이동한다.
11. 상세에서 진행 상태와 배송 정보의 인접 점을 잇는 선을 확인하고 `PICKUP_SCHEDULED → PICKUP_IN_PROGRESS → PRODUCT_RECEIVED`로 진행한다.
12. 주문 후 공식 장인 최종 실물 검수에서 사진으로 보이지 않던 내부 원단 손상을 확인하고 `CHANGE_REQUIRED`로 전환한다.
13. 고객은 변경 재활용률 68%, 제작비 195,000원, 예상 기간 4~5주와 사유를 비교하고 변경 조건을 승인한다.
14. `PRODUCTION_READY → IN_PRODUCTION → QUALITY_CHECK → SHIPPED → DELIVERED → COMPLETED`를 확인한다.
15. 완료 후 보증서 `ESG-RB-20260817-0001`, 최종 재활용률 68%, 예상 탄소 절감량 3.43kg CO2e를 확인한다.

## 상태 흐름

### 접수·분석

```text
DRAFT → READY_TO_SUBMIT → SUBMITTED → AI_ANALYZING → AI_COMPLETED
```

대표 분기는 다음과 같다.

```text
AI_ANALYZING → SUPPLEMENT_REQUIRED → DRAFT
AI_ANALYZING → AI_INELIGIBLE
AI_ANALYZING → FAILED → AI_ANALYZING
```

### 주문·제작

```text
PENDING_PAYMENT → ORDER_PLACED → PICKUP_SCHEDULED → PICKUP_IN_PROGRESS
→ PRODUCT_RECEIVED → EXPERT_INSPECTION → CHANGE_APPROVAL_REQUIRED
→ PRODUCTION_READY → IN_PRODUCTION → QUALITY_CHECK
→ SHIPPED → DELIVERED → COMPLETED
```

전문가 실물 검수는 주문 전 승인 게이트가 아니다. 주문·Mock 결제와 제품 수거가 끝난 뒤에만 수행한다.

## 고객 예외 흐름

- 업로드 형식·개수·크기가 JPG/JPEG·PNG, 필수 구도 7장, 장당 10MB 규칙과 다르면 입력을 보존하고 수정 방법을 안내한다.
- 카메라 권한이 거부되거나 지원되지 않으면 파일 선택 폴백으로 같은 슬롯에 등록한다.
- 사진 품질이 낮으면 `422 IMAGE_QUALITY_INSUFFICIENT`와 이미지별 재촬영 안내를 보여 주고 성공 분석을 만들지 않는다.
- live 분석이 실패하면 fixture/hybrid 폴백을 사용한다. 같은 접수에서는 예상 수치가 바뀌지 않아야 한다.
- 최초 분석 완료 뒤 접수 현황 경로를 다시 열면 현황 화면을 반복하지 않고 같은 접수의 AI 분석 결과로 이동한다. 오류·보완 상태를 명시한 경로는 해당 안내를 유지한다.
- 명백한 비대상 제품은 `AI_INELIGIBLE`로 주문을 차단할 수 있다. 이를 공식 가품 판정으로 표현하지 않는다.
- 추천 후보가 없으면 주문으로 강제 진행하지 않고 재촬영·정보 보완 또는 상담 안내를 제공한다.
- 실물 검수 결과가 `NO_CHANGE`이면 바로 `PRODUCTION_READY`로 진행한다.
- 실물 검수 결과가 `CHANGE_REQUIRED`이면 변경 사유·재활용률·금액·기간을 표시한다. 고객 승인 전에는 제작을 시작하지 않는다.
- 변경 조건을 거절하거나 `PRODUCTION_UNAVAILABLE`이면 주문을 `CANCELED`로 전환하고 Mock 결제 취소·환불 안내를 표시한다.
- 결제·배송·보증서가 아직 생성되지 않은 경우 빈 상태를 오류와 구분한다.
- 신청 내역이 없으면 `/orders`에서 빈 상태와 다음 행동을 보여 주며 임의의 상세로 redirect하지 않는다.
- 다른 고객의 접수·주문 식별자로 접근하면 데이터 내용을 노출하지 않고 권한 오류를 반환한다.

## 운영자·장인 콘솔 흐름

- `OPERATOR`는 PC `/operations`에서 신청 목록을 확인하고 상품을 선택해 `/operations/[applicationId]` 상세로 이동한다.
- 관리자 보기에서는 수거·배송 등 운영 단계를, 장인 보기에서는 실물 검수·제작·품질 단계를 확인하고 준비된 다음 단계 버튼을 누른다.
- 고객 화면의 주문·조회 버튼은 v2 API를 호출해 DB 상태와 신청 식별자를 갱신·조회한다. 운영 콘솔의 다음 단계 버튼은 구현된 v2 lifecycle command의 인접 전이·운영자 권한·멱등성 규칙을 그대로 사용한다.
- 고객 골든 패스에 주문 전 선승인 동작을 추가하지 않는다. 공식 장인 실물 검수는 `PRODUCT_RECEIVED` 이후에만 나타난다.
- 골든 시나리오는 `InspectionResult = CHANGE_REQUIRED`, `ChangeDecision = APPROVED`다.
- 실제 장인 계정, 검수 입력 도구, 생산 배정과 외부 운영 데이터 연동은 MVP 범위 밖이다.
- 제작 후 `QUALITY_CHECK`는 완성품 QA이며 주문 전 AI 판단을 승인하는 단계가 아니다.

## 공개·보조 흐름

- 상태 확인은 공개 `GET /api/v2/health` Route Handler를 사용한다. HTTP 200만 보지 않고 `status`가 `ok`인지 확인하며, 외부 설정·DB 조회가 준비되지 않은 현재 로컬 환경의 `degraded`를 연결 성공으로 해석하지 않는다.
- 진행 중 보증서 미리보기는 가능하지만 공식 `ISSUED` 표시는 `COMPLETED` 뒤에만 제공한다.
- 보증서 검증 URL은 공개할 수 있으나 데모 데이터이며 법적 효력을 주장하지 않는다.
- 분석 퍼널 이벤트는 Bearer 인증 사용자만 전송하며 개인정보를 넣지 않는다. event/metadata allowlist, 연결 리소스 가시성 검사와 사용자별 rate limit을 적용한다.

## 화면 공통 상태

모든 화면은 공통 원형 로딩, 빈 데이터, 재시도 가능한 오류, 권한 거부를 구분한다. 신청 내역과 마이페이지는 로그인 초기 로딩의 사용자별 메모리 캐시를 즉시 사용하고, 진입 시 백그라운드 API 응답이 달라질 때만 표시 데이터를 교체한다. 세션 만료·401·로그아웃·다른 사용자 로그인에는 캐시를 폐기한다. 등록·주문 단계에서 오류가 나도 사진과 입력을 가능한 한 보존한다. 예상치에는 `사진 기반 AI 예상`, 주문 후 변경에는 `공식 장인 실물 검수 결과`를 명시해 두 값을 혼동시키지 않는다.

## Historical 전이 참고

2026-08-17 이전 문서의 아래 전이는 기록 보존용이며 현재 골든 흐름에 사용하지 않는다.

```text
PENDING_PAYMENT → PENDING_APPROVAL → APPROVED
REVIEW_REQUIRED → AWAIT_MANUAL_REVIEW → 신청 생성 차단
```

현재는 `PENDING_PAYMENT → ORDER_PLACED` 뒤 제품 수거와 실물 검수로 진행한다.
