# API 계약 운영 규칙

## 기준

- HTTP API의 기계 판독 기준은 `openapi.yaml`이다.
- 구현 의도와 예시는 `MCM_REBORN_API_GUIDE.md`, 데모 Fixture는 `mock-data.json`을 따른다.
- 영속 구조, 제약과 RLS의 기준은 `supabase-schema.sql`이다.
- 현재 기준 계약 버전은 `1.1.0`이며 기준 브랜치는 `develop`이다.

파일이 서로 다르면 한 파일을 임의로 정답 처리해 덮어쓰지 않는다. 차이, 소비자와 데이터 영향, 호환 가능한 선택지, 권장안을 이슈에 기록한다.

## 계약 변경으로 보는 항목

- URL, HTTP 메서드, 인증·권한, 헤더와 멱등성 정책
- 요청 파라미터·본문, 응답 필드, 상태 코드와 오류 형식
- 상태 전이, 열거값, 필수 여부, null 가능 여부와 기본값
- OpenAPI schema·example 또는 Mock 소비자가 의존하는 JSON 형태
- DB table·column·enum·constraint·index·RLS와 데이터 변환

내부 구현만 바뀌고 외부 관찰 결과가 같다면 그 근거를 PR에 남긴다.

## 현재 MVP 불변조건

- `POST /analyses`의 사진 품질 미달은 `422 IMAGE_QUALITY_INSUFFICIENT`다. `details.imageQuality.status`는 `RECAPTURE_REQUIRED`이며 각 문제에는 `assetId`, 문제 코드와 `guidanceKo`가 있다.
- 사진 품질 미달은 AI 제공자 장애가 아니므로 hybrid 폴백으로 성공 처리하지 않고 성공 분석도 생성하지 않는다.
- `authenticitySignal`은 `NOT_EVALUATED` 또는 `REVIEW_REQUIRED`만 사용하며 정품·가품 확정값을 추가하지 않는다.
- `REVIEW_REQUIRED` 분석에는 `PENDING` 수동 검토 건이 하나 연결되고 신청 생성은 차단된다.
- 차단된 `POST /applications`는 `422 AUTHENTICITY_REVIEW_REQUIRED`와 `manualReviewCaseId`, `manualReviewStatus = PENDING`, `nextAction = AWAIT_MANUAL_REVIEW`를 반환한다.
- `AUTHENTICITY_REVIEW_REQUIRED`는 `application_status` 값이 아니다. 이 경로에서는 신청 레코드를 만들지 않는다.
- 수동 검토 완료·차단 해제 API와 운영 UI는 현재 MVP 계약에 없다.

## 변경 게이트

편집 전에 다음을 충족한다.

1. 계약 변경 전용 이슈와 변경 이유가 있다.
2. 기존 호출자, UI, 서버, 데이터와 데모 영향을 식별했다.
3. 하위 호환성, 마이그레이션과 롤백 방안을 작성했다.
4. 프런트엔드와 백엔드 담당자 모두 승인했다.
5. MVP와 Phase 2 경계가 달라지면 제품 담당자가 승인했다.

승인이 없으면 영향 분석과 계약 제안까지만 작성하고 `openapi.yaml`, Mock, DB와 구현은 변경하지 않는다.

## 계약 우선 변경 순서

1. `openapi.yaml`의 schema와 성공·오류 example을 수정한다.
2. `mock-data.json`, 공유 타입과 상수를 동기화한다.
3. 서버 동작과 `supabase-schema.sql` 또는 별도 migration을 반영한다.
4. 클라이언트 호출과 로딩·빈 상태·오류·권한 UI를 반영한다.
5. 단위·통합·계약 테스트를 추가한다.
6. API 가이드와 관련 `docs/`를 갱신한다.

호환 가능한 추가 필드와 단계적 폐기를 우선하며, 여러 산출물을 장기간 불일치 상태로 남기지 않는다.

## 보안·데이터 검토

- 인증 주체, 리소스 소유권과 운영자 권한을 명시한다.
- RLS와 서버 권한이 서로 우회 경로를 만들지 않는지 확인한다.
- 생성·결제·승인 같은 쓰기는 중복 호출, 재시도와 멱등성 범위를 정의한다.
- DB 변경은 기존 데이터 변환, enum·constraint, index, rollback을 함께 설계한다.
- 오류는 내부 비밀값·개인정보를 노출하지 않으며 일관된 구조를 사용한다.
- Mock과 example에는 실제 고객·운영 데이터를 넣지 않는다.

## 필수 검증

- YAML과 JSON 파싱, OpenAPI `$ref`, operationId와 example 정합성
- OpenAPI, Mock, 타입, 서버 응답과 DB 열거값·제약의 일치
- 정상, 오류, 빈 결과, 권한 거부와 외부 제공자 실패
- 상태 전이와 멱등 요청의 반복 실행
- migration 적용·롤백 또는 fresh bootstrap 조건

루트 계약 검증은 저장소 루트에서 실행한다.

```bash
python validate_package.py
```

앱의 계약 소비 코드가 바뀌면 저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `mcm-reborn/package.json`에는 테스트 스크립트가 없다. `npm test`를 실행하거나 자동 테스트가 통과했다고 표시하지 말고, 계약 검증과 완료 조건별 수동 검증 결과를 기록한다. 실행하지 못한 검사는 이유, 수동 확인 방법과 남은 위험을 PR에 남긴다.
