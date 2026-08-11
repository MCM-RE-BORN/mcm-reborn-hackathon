# MVP 사용자 흐름

이 문서는 화면과 상태 흐름을 설명한다. 정확한 요청·응답과 상태 코드는 `openapi.yaml`을 따른다.

## 고객 정상 흐름

1. 데모 고객으로 로그인하고 본인 프로필을 확인한다.
2. 가방 사진 1~4개의 업로드 URL을 발급받아 private storage에 업로드한다.
3. 분석을 요청한다. 사진 품질을 통과하면 상태 등급, 소재·손상, 재활용률·면적과 정품 검토 신호를 확인한다.
4. `authenticitySignal = NOT_EVALUATED`인 분석으로 파우치, 카드 지갑, 키링 목록을 비교한다.
5. 제품 상세에서 완성 이미지와 GLB·glTF 3D 모델을 확인한다.
6. 배송 정보와 동의를 입력해 신청을 만든다. `REVIEW_REQUIRED` 분석에는 이 단계로 진입하지 않는다.
7. 데모 카드로 Mock 결제하고 접수 대기 상태를 확인한다.
8. 운영자 승인 뒤 타임라인과 Mock 배송 상태를 조회한다.
9. 완료 상태에서 ESG 보증서를 열고 공개 검증 화면을 확인한다.

정상 신청 상태는 다음 순서다.

```text
PENDING_PAYMENT → PENDING_APPROVAL → APPROVED → RECEIVING_PRODUCT
→ PRODUCT_RECEIVED → IN_PRODUCTION → QUALITY_CHECK → SHIPPED → COMPLETED
```

배송 상태는 `PICKUP_RESERVED → PICKUP_IN_PROGRESS → AT_WORKSHOP → OUT_FOR_DELIVERY → DELIVERED`로 표현한다.

## 고객 예외 흐름

- 업로드 형식·개수·크기가 계약과 다르면 입력을 보존하고 수정 방법을 안내한다.
- 사진 품질이 낮으면 `POST /analyses`가 `422 IMAGE_QUALITY_INSUFFICIENT`를 반환한다. 성공 분석은 생성하지 않으며 `imageQuality.issues`의 `assetId`, 문제 코드와 `guidanceKo`를 사용해 해당 사진의 재촬영을 안내한다.
- live 분석이 실패했을 때 `AI_MODE=hybrid`이면 준비된 Fixture를 사용하고 폴백 사실을 응답과 UI에서 숨기지 않는다.
- 사진 품질 오류는 제공자 장애가 아니므로 hybrid 폴백 대상으로 처리하지 않는다.
- 분석이 실패하거나 추천 가능한 제품이 없으면 신청으로 강제 진행하지 않고 재시도 또는 안내 상태를 보여 준다.
- 정품 신호가 `REVIEW_REQUIRED`이면 이를 정품·가품 판정으로 표현하지 않는다. 시스템은 `PENDING` 수동 검토 건을 만들고 `POST /applications`에서 `422 AUTHENTICITY_REVIEW_REQUIRED`, `applicationCreationBlocked = true`, `nextAction = AWAIT_MANUAL_REVIEW`를 반환한다.
- `AUTHENTICITY_REVIEW_REQUIRED`는 신청 상태가 아니라 신청 전 오류·검토 사유다. 이 경로에서는 신청, 결제와 제작 타임라인을 생성하지 않는다.
- 생성된 신청은 `ADDITIONAL_REVIEW_REQUIRED`, `PRODUCTION_UNAVAILABLE`, `CANCELED` 예외 상태를 표시할 수 있다.
- 결제·배송·보증서가 아직 생성되지 않은 경우 빈 상태를 오류와 구분한다.
- 다른 고객의 분석·신청 식별자로 접근하면 데이터 내용을 노출하지 않고 권한 오류를 반환한다.

## 운영자 흐름

1. 데모 운영자로 로그인한다.
2. 신청 목록을 상태로 필터링하고 상세를 연다.
3. 분석 요약, 선택 제품, 배송 정보와 현재 상태를 검토한다.
4. 승인 가능한 신청만 승인하고 멱등성 키를 사용한다.
5. 고객 화면에서 승인 이후 타임라인이 정상 진행되는지 확인한다.

운영자 MVP는 생성된 신청의 목록·상세·승인에 집중한다. `REVIEW_REQUIRED` 수동 검토 건을 완료하거나 차단을 해제하는 API·UI는 제공하지 않는다. 장인 배정, 실물 검수, 생산 용량, A/S와 상세 감사 화면은 Phase 2다.

## 공개·보조 흐름

- 상태 확인용 `/health`는 인증 없이 사용할 수 있다.
- 보증서 검증 URL은 공개지만 데모 데이터이며 법적 효력을 주장하지 않는다.
- 분석 퍼널 이벤트는 인증 사용자 또는 익명으로 보낼 수 있으므로 개인정보를 담지 않고 남용 방지 정책을 둔다.

## 화면 공통 상태

모든 화면은 최소한 로딩, 빈 데이터, 재시도 가능한 오류, 권한 거부를 구분한다. 오류가 발생해도 이전 입력과 사용자가 취할 다음 행동을 가능한 한 보존한다.
