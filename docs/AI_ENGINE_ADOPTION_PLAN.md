# AI 엔진 비판적 도입 계획

> 기준일: 2026-08-17
>
> 상태: 실행 계획(현재 구현 보고서가 아님)
>
> 상위 SSOT: [`MVP_DEMO_CANONICAL.md`](./MVP_DEMO_CANONICAL.md)
>
> 현재 계약: API 계약 v2.0.0 / OpenAPI 3.1.0

## 1. 결론

첨부 설계안은 다음 이유로 **중장기 target architecture로는 타당**하다.

- 이미지 픽셀 비율이 아니라 실제 패널·패턴 공간에서 회수 가능 영역을 다룬다.
- 총면적이 아니라 2D 패턴 부품이 실제로 배치되는지 검증한다.
- 원본 패널, 안전 마스크, 재단 배치, 3D UV 사이의 추적성을 유지한다.
- 장인 수정과 실제 제작 결과를 다음 모델의 학습 데이터로 축적한다.

그러나 SAM·VGGT·COLMAP·GPU worker·CP-SAT·실시간 PBR을 동시에 구축하는 것은 현재 **시연용 MVP에는 과도**하다. 고객 스마트폰 사진만으로 실제 cm², 제조 가능한 폴리곤, 결 방향, 동일 물리 가죽의 UV를 보장할 수도 없다.

따라서 두 Lane으로 분리한다.

1. **Lane A / 주문 전 목표:** 스마트폰 사진의 품질·provenance를 확인하고 보수적 예상치, 신뢰도, `ABSTAIN`을 제공한다. 정품·제조 가능 확정이 아니다.
2. **Lane B / 주문 후:** 수거·입고·해체 뒤 평면 캘리브레이션 스캔으로 실제 usable polygon, 결함, 결 방향, nesting을 만들고 장인이 승인한다.

전문가 점검은 반드시 `ORDER_PLACED → PRODUCT_RECEIVED` 뒤에 수행한다. 주문 전 고객 사진 분석에는 장인 승인 상태를 만들지 않는다.

현재 앱은 Lane A의 완성형 제조 AI 엔진이 아니다. 브라우저 화면은 실제 촬영을 v2 분석·제품·신청 API에 연결하고, 서버 `DEMO_FIXTURE` 모드에서는 재현 가능한 예상치를 표시한다. 서버에는 6장 분석 Route Handler, 품질 오류, 세 분석 모드와 주문·실물 검수 영속 모델이 구현됐지만, 실제 CUSTOMER/OPERATOR 전체 여정과 OpenAI LIVE 품질 모델 실행은 staging 검증 대상이다. provenance hash·`ABSTAIN`·geometry revision·Lane B 재단 데이터는 아직 구현하지 않았다.

## 2. 현재 구현 / 설계 채택 / 보류

### 현재 구현됨

| 기능 | 실제 구현 경계 |
|---|---|
| 브라우저 촬영 | 후면 카메라 우선, 촬영 미리보기·재촬영·파일 선택 폴백. Blob과 입력은 클라이언트 세션 메모리이며 영속 provenance 저장은 없음 |
| 기본 입력 검증 | 사진 장수·MIME·용량과 카메라 오류를 클라이언트에서 확인. 흔들림·초점·노출·반사 같은 이미지 품질 판정은 하지 않음 |
| 중앙 Fixture 예상 | 같은 시나리오에서 72%·91%와 `estimateMeta.mode/confidencePercent/notice`를 일관되게 표시하고 v2 분석 서비스도 같은 루트 Fixture를 소비. estimator/ruleset 버전·입력 digest·seed 기록은 없음 |
| 데모 trace | 화면이 v2 API의 분석·신청·상태·검수·변경안·보증서 ID를 사용한다. `DEMO_FIXTURE`는 서버 분석 결과에 한정되며, 원격 전체 여정과 제조 geometry revision은 검증·구현 대상 |
| 품질 오류 계약 | `POST /api/v2/analyses`가 `422 IMAGE_QUALITY_INSUFFICIENT`와 이미지별 재촬영 안내를 구현. 실제 이미지 품질 모델의 staging 실행은 미검증 |

### 설계 원칙으로 채택 — 구현 예정

| 항목 | 현재 상태와 다음 적용 |
|---|---|
| 촬영 provenance | **계획:** 슬롯, 카메라/파일 출처, 시각, 해상도·용량, 콘텐츠 해시, 앱 버전, 품질 평가를 API·DB에 기록 |
| 촬영 품질 gate | **계획:** 흔들림·초점·노출·반사·잘림·누락을 판정하고 품질 실패를 분석 성공으로 폴백하지 않음 |
| 결정론적 예상 | **부분 구현:** 모드·신뢰도·고지는 계약/Fixture에 있음. scenario/model/ruleset 버전, 입력 digest와 seed는 향후 호환 필드로 추가 |
| 예상/실측 분리 | **부분 구현:** 중앙 Fixture에 주문 전 72%와 실물 검수 후 68%가 분리됨. 범용 `EstimateRun`·measurement revision 영속 모델은 계획 |
| 동일 주문 trace | **부분 구현:** UI가 v2 DB의 신청·상태 이력·검수·변경안·보증서·멱등 쓰기 구조를 조회·호출한다. 원격 전체 여정과 제조 revision audit는 남음 |
| 제조 추적 원칙 | **계획:** 원본 패널↔안전 마스크↔2D 패턴↔재단안↔3D UV를 versioned ID로 연결 |
| `ABSTAIN` | **계획:** 현재 v2 enum/응답에는 독립된 `ABSTAIN` 결과가 없음. 추가 촬영·정보 보완 계약과 함께 additive change로 설계 |
| 피드백 데이터 | **계획:** 장인 수정 전후, 승인 사유, 실제 해체 면적·손실·제작 결과를 권리·보관 정책과 함께 축적 |

### 지금 보류

| 항목 | 이유와 재검토 Gate |
|---|---|
| SAM 자동 분할 | MCM 실측 라벨과 법률 검토 확보 후 정확도·상용 조건 평가 |
| VGGT 형상·포즈 | 고객 사진 절대 scale·비강체 형상을 보장하지 못함; 알려진 SKU pilot 기준선 통과 후 |
| GPU worker/orchestrator | 데모 Fixture에 불필요; pilot 처리량·지연 SLO 확인 후 |
| COLMAP/PyCOLMAP | Lane A 예상에 과도함; Lane B 정밀 스캔/unknown-SKU 연구에서 검토 |
| CP-SAT/ILP nesting | 검증된 polygon·봉제 여유·결 방향 데이터와 수동 기준선 확보 후 |
| 실시간 PBR/baking | actual cut plan trace 100% 전에는 오해 가능; 현재 정적 목업 유지 |
| 제조 가능 확정 | 고객 사진만으로 금지; Lane B 해체·실측·장인 승인 뒤에만 생산 진행 |

## 3. Two-Lane 운영

### Lane A — 고객 스마트폰 사전 예상 목표

입력은 Canonical의 정면·후면·상단·하단·좌측면·우측면 JPG/PNG, 총 6장이다. 선택적인 시리얼 번호 촬영본은 텍스트 자동 입력에만 사용한다.

현행 v2의 `LIVE`는 공식 OpenAI JavaScript SDK의 Chat Completions Structured Outputs를 사용하고 제공자 장애 시 중앙 Fixture로 폴백한다. private 이미지를 외부로 전송하려면 배포 opt-in, 고정 privacy notice, 요청별 명시 동의와 DB 증적이 모두 필요하다. 이미지 품질 실패는 폴백 성공으로 바꾸지 않으며, 실제 OpenAI 호출과 동의 증적의 원격 동작은 아직 검증되지 않았다.

```text
CaptureAsset → QualityGate → deterministic EstimateRun
→ conservative recommendation / ABSTAIN → Mock order
```

브라우저는 실제 촬영 뒤 중앙 Fixture 화면으로 이동하므로 이 파이프라인을 호출하지 않는다. v2 분석 서비스는 정확히 6개 업로드 자산, 품질 결과와 결정론적 Fixture/규칙 기반 예상치를 처리하지만 독립 `EstimateRun` revision과 `ABSTAIN` 판정기는 없다.

허용 출력:

- 촬영 품질과 재촬영 사유
- 관찰된 상태·손상 후보와 항목별 신뢰도
- 현행 v2에서는 예상 재활용률·필수 예상 면적 숫자와 `estimateMeta`; 향후 additive 계약 뒤 면적 범위·보류 상태
- 정품 사전 점검 예상과 `정품 확정 아님` 고지
- 추가 촬영 또는 정보 보완을 요청하는 향후 `ABSTAIN`

금지 출력:

- 고객 사진에서 실측한 것처럼 보이는 절대 cm²
- usable polygon, 결 방향, 재단안, 제조 가능, 정품, 최종 견적 확정
- 합성/inpainting 영역을 실제 가죽으로 표시
- 주문 전 장인 승인 상태

API 계약 v2.0.0(OpenAPI 3.1.0)의 `Analysis`는 `estimatedReusableAreaCm2`를 필수 숫자로 요구하고 중앙 데모 example은 `3024`다. 현재는 이 값을 **예상 Fixture 값**으로만 표시해야 하며 실측 면적이라고 부르지 않는다. 현행 v2 응답에서 값을 생략하거나 숫자 대신 범위를 반환하면 계약 위반이다. scale 신뢰도가 낮은 Lane A에서 면적을 보류하거나 범위로 제공하려면 `absoluteScaleStatus`, 범위 하한·상한 또는 별도 availability 필드 같은 additive 계약을 먼저 추가하고 기존 단일 숫자의 단계적 폐기·소비자 마이그레이션을 정의한다.

### Lane B — 주문 후 입고·해체 실측

```text
입고 식별 → 해체 → 패널별 평면 캘리브레이션 스캔
→ measured panel/defect/grain polygon → artisan safe mask
→ pattern placement/nesting → 장인 승인 또는 변경
→ 고객 변경 승인 → production cut plan
```

최소 조건:

- 패널을 겹치지 않고 동일 평면에 배치하고 검증된 scale/fiducial·컬러 패치를 둔다.
- 조명·카메라 높이·렌즈를 고정하고 왜곡 보정·캘리브레이션 버전을 기록한다.
- 앞/뒤, 결 방향, 봉제선·접착·결함을 표시하고 반복 스캔으로 재현성을 확인한다.
- 장인 수정 안전 마스크, 2D 패턴, 재단 배치, 실제 회수 면적·손실을 revision으로 남긴다.

### API 계약 v2.0.0 중앙 시나리오 연결

| 추적 단계 | Canonical 연결 |
|---|---|
| Lane A 제출 | `SUB-RB-20260817-0001`: MCM 모노그램 백팩(2019, 5년 이상) → RE:BORN 여권지갑 |
| 주문 전 예상 | 재활용률 72%, 정품 사전 점검 예상 91%(주문 적합 참고 신호), 180,000원, 무료 수거 |
| Lane B 주문 | `RB-20260817-0001`: 수거·입고 뒤 전문가 실물 검수 `CHANGE_REQUIRED` |
| 변경 승인 | 실물 검수 Fixture의 68%, 195,000원, 4~5주를 고객이 승인한 뒤 `PRODUCTION_READY`. v2 DB는 확정 재활용률·면적과 변경안을 저장하지만 실제 평면 스캔 polygon·결 방향·재단안 같은 Lane B 측정 revision은 미구현 |
| 완료 | `ESG-RB-20260817-0001`: 최종 68%, 탄소 저감량은 **추정치** 3.43kg CO2e |

## 4. 계약과 추적 데이터 원칙

### Capture provenance 제안 필드

다음은 향후 API·DB에 추가할 최소안이며 현재 캡처 세션이나 API 계약에 모두 존재하는 필드가 아니다.

```text
assetId, slot(LEFT_SIDE|RIGHT_SIDE|BOTTOM|REAR)
source(CAMERA|FILE_PICKER|DEMO_FIXTURE), capturedAt
contentSha256, mimeType, widthPx, heightPx, bytes
orientationNormalized, exifRemoved, captureClientVersion
qualityAssessmentId
```

위치·원본 EXIF·장치 모델 등 개인정보는 기본 수집하지 않는다. 필요 시 별도 동의·보관·삭제 정책을 둔다.

### 결정론적 `estimateMeta` 확장 제안

현행 v2 `estimateMeta`가 보장하는 필드는 `mode`, `confidencePercent`, `notice`뿐이다. 아래 나머지 필드는 향후 additive 계약 후에만 사용할 수 있다.

```text
mode(DEMO_FIXTURE|SEEDED_ESTIMATE|LIVE), confidencePercent, notice
scenarioKey, estimatorVersion, rulesetVersion
inputAssetIds[], inputDigest, seedKey, generatedAt
absoluteScaleStatus(NOT_AVAILABLE|SKU_DERIVED|CALIBRATED_ESTIMATE)
abstainReasonCodes[]
```

향후 같은 `scenarioKey + estimatorVersion + inputDigest`는 같은 결과를 반환해야 한다. 재분석을 기존 값 위에 덮어쓰지 않고 새 `EstimateRun` revision으로 만드는 것도 목표 불변조건이며 현재 영속 구현은 없다.

불변조건:

- `estimatedReusableMaterialRate`와 `confirmedReusableMaterialRate`를 분리한다.
- 화면은 `AI 예상 72% → 실물 검수 68%`처럼 출처·시점을 함께 표시한다.
- `confidencePercent`의 정의·보정 데이터·버전을 관리하고, `ABSTAIN`을 정상 결과로 취급한다.

### 제조 추적 모델 제안

아래 모델은 Lane B pilot에서 도입할 목표 구조이며 현재 스키마나 앱에 구현되어 있지 않다.

```text
Submission → EstimateRun → CaptureAsset[]
Order → PhysicalInspection → SourcePanelRevision[]
→ Defect/Grain/SafeMaskRevision → CutPlanRevision → CutPlacement[]
→ PatternPartRevision → MeshUvBindingRevision → ProductionOutcome
```

- 모든 geometry는 좌표계, 단위, scale source, revision을 가진다.
- 안전 마스크는 AI 제안과 장인 수정·승인을 구분한다.
- 패턴은 실제 SVG/DXF, 치수, 봉제 여유, 결 방향, 미러링 규칙을 참조한다.
- 배치는 panel/mask/pattern, 변환행렬, 회전·미러링 상태를 연결한다.
- UV binding은 pattern part와 GLB primitive/UV set을 연결한다.
- 장인 수정 시 preview/cut plan을 새 revision으로 다시 만들며 과거 revision은 보존한다.
- 합성 텍스처는 `SYNTHETIC`으로 표시하고 생산·보증서 근거로 쓰지 않는다.

## 5. 핵심 주장 검증표

| 주장 | 허용을 위한 검증 조건 | 주요 실패 모드와 현재 정책 |
|---|---|---|
| 원제품 총면적 | 권위 있는 SKU 패턴/BOM revision 또는 주문 후 전체 패널 해체·평면 스캔; 소재 분모·누락 검사·반복 오차 명시 | 안감/코팅 캔버스 오분류, 접힘·겹침 이중 계산, 내부 누락, 해체 손실 혼합. Lane A는 실측 cm² 주장 금지 |
| 고객 사진 절대 scale | intrinsic·왜곡 보정, 대상과 같은 평면의 marker, SKU 실치수 교차 검증, 재투영·반복 오차 기준 통과 | 광각 왜곡, 곡면을 평면 가정, 잘못된 기준 물체, 뷰 간 불일치. 현재 v2는 예상 Fixture 숫자를 유지하고, 향후 additive 계약 뒤 `NOT_AVAILABLE`·범위·`ABSTAIN` 적용 |
| 동일 물리 가죽 UV | 해체 panel atlas와 불변 panel ID, 동일 좌표/revision의 cut placement·pattern·UV binding, landmark 역추적, 수정 후 재생성 | 미러링, seam allowance 누락, stale atlas/preview, inpainting 오인, 늘어남·수축. 통과 전 `적용 예시`만 허용 |

제조 가능은 Lane B 검증을 모두 통과하고 장인이 승인한 뒤에만 운영 상태로 확정한다.

## 6. 향후 `ABSTAIN` 정책

현재 API 계약 v2.0.0에는 독립된 `ABSTAIN` 결과가 없다. 향후 additive 상태·사유·다음 행동 계약을 승인한 뒤, Lane A는 다음 중 하나면 단일 제작 가능 수치를 내지 않도록 한다.

- 필수 6슬롯 중 하나라도 누락, 초점·노출·반사·잘림 실패
- 동일 패널 식별·coverage 부족, SKU·소재·크기 불명확
- 광택·검은 소재·변형 때문에 결함이 관찰되지 않음
- 추천 근거가 보이지 않는 영역이나 합성 영역에 의존
- calibration 범위 밖 입력 또는 provenance/input digest 불완전

향후 결과에는 `추가 촬영`, `정보 보완`, `주문 상담` 중 다음 행동을 붙인다. 그 계약이 구현되기 전에는 현재 품질 미달·보완 요청 상태와 `ABSTAIN`을 같은 기능이라고 주장하지 않는다.

## 7. 단계별 실행 계획과 Gate

### Stage D — 현재 Demo / Lane A

- 구현됨: 실제 모바일 촬영, 기본 파일 검증, 중앙 Fixture 예상, 정적 추천·목업, Mock 주문·결제 화면, 별도 v2 6장 분석·주문·검수·변경 승인·lifecycle·보증서 Route Handler와 DB 계약.
- 미구현 또는 미연결: 실제 Supabase 전체 여정/OpenAI LIVE 검증, 영속 content hash, 독립 EstimateRun, `ABSTAIN`, 제조 geometry revision/audit 저장.
- 시나리오: 72%·91% 예상 → 주문 후 `CHANGE_REQUIRED` → 승인 → 68% 보증서 trace.
- 제외: 실제 polygon/nesting/UV 생성과 제조 가능 확정.
- Stage D 완료 목표: 같은 입력·버전 결과 일치 100%, 영속 end-to-end trace 100%, 품질 실패 분석 생성 0건, 확정 오인 카피 0건, 골든/복구 경로 통과. 현재 데모 통과 결과를 이 엔진 Gate 달성으로 간주하지 않는다.

### Stage P — 알려진 SKU Pilot / Lane B

- 범위: 백팩 1개 SKU군과 여권지갑 1종, 권리 확인된 SVG/DXF·GLB/UV, 해체·평면 스캔 SOP.
- 구현 순서: 수동 polygon/장인 수정 도구 → heuristic/manual nesting → 검증 후 자동 모델 비교.
- 데이터: actual cut plan, 실제 회수 면적·손실·제작 성공/실패를 같은 주문 trace에 저장.
- Gate: 반복 면적 오차 ≤2%, 고신뢰 회수율 MAE ≤10pp, 중대 결함 recall ≥95%, false-feasible ≤5%.
- Gate: Top-3 장인 승인 후보 존재율 ≥80%, hard constraint 위반 0건, geometry/UV trace와 결과 저장 100%.
- 수치는 초기 목표이며 pilot 데이터로 재설정한다. 최종 생산에는 계속 장인 승인이 필요하다.

### Stage R — Production readiness

- SKU·소재·조명별 독립 holdout, confidence calibration, OOD/ABSTAIN 검증.
- 모델·규칙·제조 자산 revision 재현·rollback, 회귀·drift 감시.
- 고객 동의·학습 권리·삭제, 암호화·접근 제어·audit/retention 승인.
- 지연·비용·GPU capacity·장애 복구 SLO와 장인 override audit trail 검증.
- 실제 cut plan↔3D preview trace audit 100%. Lane A는 계속 주문 참고 예상이다.

## 8. 데이터·라이선스·운영 지표

### 주문 후 학습 데이터

```text
CaptureAsset + Lane A EstimateRun → 입고 사진 → 해체 panel scan
→ measured defect/grain polygon → AI mask + artisan correction
→ pattern placement/actual cut plan → 실제 회수 면적·손실·품질 결과
```

서비스 제공 동의와 모델 학습 동의를 분리한다. 장인 수정은 before/after와 사유를 남기고, 실패·거절·ABSTAIN도 보존한다. MCM이 권리를 가진 패턴·BOM·3D 자산만 사용한다.

### 라이선스 checkpoint

아래는 기술 검토 메모이며 법률 의견이 아니다. 정확한 버전·파일·의존성 기준 확인이 필요하다.

| 기술 | 위험과 Production Gate |
|---|---|
| VGGT | 상업 사용 가능 checkpoint 조건이 별도일 수 있다. 정확한 URI/hash와 코드·가중치 각각의 license text를 고정하고 법무 승인 전 사용 금지 |
| SAM 3/3.1 | MIT/Apache가 아닌 custom SAM License. 사용·배포·고지·trade control·파생 모델 조건을 버전별 확인 |
| nvdiffrast | 공식 조건상 비-NVIDIA 상용 서비스에 부적합할 가능성. 별도 상용 허가 없으면 production dependency 금지, 대체 렌더러 검토 |
| 데이터 | 고객 사진, MCM 제조 자산, 장인 수정 데이터의 목적·권리가 다름. asset registry에 동의·보관·삭제·학습 허용 기록 |

모델/의존성은 SBOM·Model BOM에 버전, hash, 출처, license snapshot, 승인자를 남긴다.

### 핵심 지표

현재 앱에는 이 지표를 수집하는 telemetry가 없다. 아래는 pilot부터 계측할 목표다.

- Lane A: 촬영 완료·재촬영·품질 gate·ABSTAIN율, 재현율, calibration, 예상↔실측 MAE.
- Lane B: 면적 오차, 중대 결함 recall, mask false-negative, 장인 수정 시간, hard violation, 실제 제작 성공률, UV trace completeness.
- 서비스: 주문 전환, 실물 검수 변경·승인·취소율, 가격·기간 변경 폭, 설명 이해도.

## 9. 다음 실행 순서

1. API 계약 v2.0.0(OpenAPI 3.1.0)의 `estimateMeta`·촬영 provenance·면적 availability gap을 기록한다.
2. 기존 `estimatedReusableAreaCm2` 소비자를 유지하는 additive 변경안으로 품질·provenance·`ABSTAIN`·범위/보류 필드를 설계하고 승인받는다.
3. 접수→분석→주문→검수→보증서 trace 감사 뷰와 Lane A 품질/`ABSTAIN` Fixture를 구현·검증한다.
4. 백팩 1개 SKU와 여권지갑 패턴·GLB·UV의 권리·revision을 확정한다.
5. 주문 후 해체·평면 스캔 SOP와 반복성 실험을 수행한다.
6. 수동 polygon·장인 수정·actual cut plan 기록 도구를 먼저 만든다.
7. 최소 pilot 데이터에서 단순 기준선과 SAM/VGGT/nesting의 추가 이득을 비교한다.
8. 정확한 라이선스·데이터 권리 승인 뒤에만 production 후보를 결정한다.

이 계획은 고성능 모델보다 검증 가능한 측정·추적·장인 피드백 루프를 먼저 만든다. 데모 MVP를 과도하게 확장하지 않으면서 장기 제조 AI에 필요한 실제 데이터를 축적하는 경로다.
