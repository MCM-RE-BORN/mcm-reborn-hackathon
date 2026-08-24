# 해커톤 데모 운영 가이드

> 2026-08-17 현재 기준. 이전의 운영자 선승인·신청 전 수동 검토 차단·별도 완료 주문 전환 시연은 **superseded/historical**이다. 전체 값과 상태는 [`MVP_DEMO_CANONICAL.md`](./MVP_DEMO_CANONICAL.md)를 따른다.

## 데모 원칙

- 목적은 실제 AI 정확도보다 최종 서비스 흐름을 자연스럽고 안정적으로 완주하는 것이다.
- 실제 AI가 어려운 상태·정품·재활용 판단은 중앙 Fixture 또는 재현 가능한 예상치로 표시한다.
- 분석 예상치는 서버 `DEMO_FIXTURE` 모드에서 재현 가능하게 생성되며, 신청·마이페이지·보증서·운영 상태는 v2 API와 Supabase DB 결과를 사용한다. 실제 촬영 Blob과 주문 입력은 분석·신청 API에 제출된 뒤 DB 식별자로 이어지며, 인증·API 오류는 임의 데모 데이터로 대체하지 않는다.
- 화면과 발표에서 AI 값은 사진 기반 예상, 결제·물류·탄소·보증서는 Mock임을 밝힌다.
- 주문 전에는 정품·제작 가능·원단 활용·견적을 확정 표현으로 말하지 않는다.
- 공식 장인 실물 검수는 주문·Mock 결제와 제품 수거가 끝난 뒤에만 수행한다.
- 기본 브라우저 데모는 외부 API를 호출하지 않고 `DEMO_FIXTURE`와 여권 지갑 전면 placeholder로 같은 주문과 보증서까지 진행한다. R5 통합 동의·키·배포 gate가 준비된 LIVE 시연에서는 최초 분석이 저해상도 외관 4면 위키 lookup과 최종 6면 Structured Output의 두 단계로 처리되고 분석과 외관 4부위 profile을 함께 저장한다. 이후 사용자가 목업 화면 버튼을 눌렀을 때 이 profile은 추가 OpenAI 호출·quota 없이 계획으로 재사용되고 외관 4장은 Meshy source/target 작업에 사용된다. 저장 profile이 없는 non-LIVE 데모/seeded 분석에서만 OpenAI 4면 classifier 호환 폴백을 선택적으로 시연한다. 생성 전·중·실패에는 placeholder를 유지하고 최종 텍스처 적용 뒤에만 3D를 공개한다.

## 중앙 시나리오 빠른 참조

| 항목 | 값 |
|---|---|
| 원제품 | MCM 모노그램 백팩, 2019, 5년 이상 사용 |
| 희망 제품 | RE:BORN 여권지갑 |
| 접수 | `SUB-RB-20260817-0001` |
| 주문 | `RB-20260817-0001` |
| AI 예상 | 재활용 가능률 72%, 정품 사전 적합도 예상 91% |
| 최초 조건 | 180,000원, 수거 무료 |
| 실물 검수 | `CHANGE_REQUIRED` |
| 변경 조건 | 68%, 195,000원, 4~5주 |
| 고객 결정 | 승인 |
| Mock 배송 | `DEMO-RB-20260817-0001`, `DELIVERED` |
| 보증서 | `ESG-RB-20260817-0001`, 68%, 3.43kg CO2e |

## 사전 준비

1. 저장소 루트에서 앱을 실행하고 `/`의 1초 시작 화면이 `/intro` 서비스 소개로 자동 이동하는지 확인한다. 홈의 직접 주소는 `/home`이다.
2. 실제 Supabase CUSTOMER·OPERATOR 계정과 역할이 연결된 `profiles` 행, `.env.local`의 공개·서버 환경변수를 준비한다. 회원가입 화면은 저장 동작이 없는 안내 폼이다.
3. 모바일 또는 모바일 에뮬레이션 환경에서 HTTPS/localhost 카메라 권한과 후면 카메라를 확인한다.
4. 실제 촬영 실패에 대비해 정면·후면·상단·하단·좌측면·우측면 JPG/PNG 예시 사진을 준비한다. 시리얼 번호 촬영은 자동 입력 시연용 선택 사진으로 별도 준비할 수 있다.
5. 중앙 시나리오 `DEMO_FIXTURE`가 접수·주문·보증서에서 같은 식별자와 수치를 표시하는지 확인한다.
6. 홈 hero 영상이 실제 재생되고, 하단 내비게이션이 `신청 내역`·`홈`·`마이페이지` 3개로 표시되는지 확인한다.
7. 저장소 루트에서 계약·앱 검증 명령을 실행한다.

현재 고객·운영 브라우저 여정에는 Supabase 환경변수와 적용된 schema·migration·Auth 역할 연결이 필요하다. 분석을 `DEMO_FIXTURE`로 실행하면 OpenAI 키는 필요하지 않다. `.env.example`을 `mcm-reborn/.env.local`로 복사하고 Supabase URL·publishable key·service role key를 설정한다. 서버 전용인 `SUPABASE_SERVICE_ROLE_KEY`와 `OPENAI_API_KEY`에는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

선택형 OpenAI/Meshy 3D 목업의 키, 공개 GLB, 분석 접수 시 R5 통합 동의, 보존 기간, quota와 비용 준비는 [`AI_TEXTURE_MOCKUP_PIPELINE.md`](./AI_TEXTURE_MOCKUP_PIPELINE.md)를 따른다. 단일 `3D 목업 생성` 버튼은 기본값 `ENABLE_TEXTURE_AI=false`에서 비활성이다. 분석 생성만으로 Meshy 작업을 자동 시작하지 않는다. current LIVE의 `EXTERIOR_PLAN`은 분석 때 저장한 profile을 읽으므로 버튼 클릭 시 별도 OpenAI 호출이나 plan quota가 없다.

```powershell
Copy-Item .\.env.example .\mcm-reborn\.env.local
```

앱 실행:

```bash
npm --prefix mcm-reborn run dev
```

별도 터미널에서 검증:

```bash
python validate_package.py
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `package.json`에 테스트 스크립트가 없다면 `npm test` 통과를 표시하지 말고 아래 시나리오를 수동 검증한다.

## 골든 시연 순서

1. 서비스 소개를 거쳐 홈의 실제 hero 영상과 `상품 진단하기` CTA를 확인하고 CTA를 선택한다.
2. 모바일 카메라를 열어 정면 사진을 촬영하고 미리보기에서 `이 사진 사용`을 선택한다.
3. 후면·상단·하단·좌측면·우측면 사진을 차례로 추가해 필수 6슬롯을 모두 채운다. 필요하면 시리얼 번호를 촬영해 입력란 자동 채우기를 시연한다.
4. 카테고리 가방, 2019년, 5년 이상, 희망 제품 RE:BORN 여권지갑을 확인한다. `AI 분석을 위한 사진 활용 동의`의 내용보기를 열어 분석 시 6장 OpenAI 전송과 외관 4부위 profile 생성, 목업 버튼 클릭 시 저장 profile 재사용과 4장 Meshy 전송·보존·비용성 호출을 함께 설명하는 R5 통합 안내를 확인한다. 동의한 뒤 `AI 분석 접수하기`를 누른다.
5. LIVE라면 첫 OpenAI `detail: low` 호출은 원래 인덱스를 유지한 `0 FRONT`, `1 REAR`, `4 LEFT`, `5 RIGHT` 외관 4면만 사용해 제품 예시가 제거된 공개 KB V1 분석용 위키를 최대 5개·4,000자로 검색한다. 두 번째 `detail: auto` 호출은 상단·하단을 포함한 6면과 PDF `MCM_REUSE_GUIDE_2026_08_21_V1`, 7개 always-on 금지 경계, 검색 결과로 v3 분석·외관 profile을 함께 만든다는 점을 설명한다. 최초 접수에서 `SUBMITTED → AI_ANALYZING`을 1~2초 보여 준 뒤 접수 `SUB-RB-20260817-0001`의 결과를 연다. 이후 접수 현황에 재진입하면 AI 결과로 바로 이동하는지 확인한다.
6. 외관·손상·오염, 예상 재활용 가능률 72%, 정품 사전 적합도 예상 91%를 보여 준다. 91%가 정품 확정이 아님을 설명한다.
7. 추천 화면의 `트래블·지갑·파우치·키링` 탭을 전환한다. 트래블의 `여권 지갑` 카드만 선택해 RE:BORN 여권지갑 목업으로 이동하고 전면 placeholder가 표시되는지 확인한다. 외부 provider를 준비한 시연에서만 `3D 목업 생성`을 한 번 누른다. current LIVE에서는 private `provider_result`의 `BODY` 필수 외관 profile을 재사용하므로 이 시점에 OpenAI 재분류나 plan quota가 없고, 외관 4장 Meshy 작업만 시작한다. 목업 화면에는 분석 narrative·외관 4면·소재 분류·5단계 절차 대신 진행률과 최소 상태만 표시한다. 생성 텍스처가 결정론적 target mask와 스티치 보존 마스크를 거쳐 PNG로 합성되고 실제 3D material에 `applied`된 뒤에만 회전 가능한 3D가 나타나는지 확인한다. `기본 3D 모델과 비교`를 누르면 사용자 제공 모델의 웹 최적화 비교 GLB가 표시되고, `맞춤 외관 다시 적용`을 누르면 canonical GLB의 합성 외관으로 돌아오는지 확인한다.
8. 수거 정보를 입력하고 최초 예상 제작비 180,000원, 수거 무료, 실물 검수 후 변경 가능 안내를 확인한다.
9. Mock 결제를 완료하고 주문 `RB-20260817-0001`, `ORDER_PLACED`를 보여 준다.
10. 하단 `신청 내역`을 선택해 `/orders` 목록을 열고 `RE:BORN 여권지갑`을 선택해 `/orders/demo` 상세로 이동한다. 진행 상태와 배송 정보의 인접 점이 선으로 연결되어 있는지 확인한다.
11. 수거 예정·수거 완료 뒤 공식 장인 최종 실물 검수로 이동한다.
12. 내부 원단 손상으로 `CHANGE_REQUIRED`가 된 사유와 72%→68%, 180,000원→195,000원, 4~5주 변경을 비교한다.
13. 고객이 변경 조건을 승인하고 `PRODUCTION_READY → IN_PRODUCTION → QUALITY_CHECK → SHIPPED → DELIVERED → COMPLETED`를 빠른 타임라인으로 보여 준다. HTTP/Mock 계약을 함께 설명할 때는 운송장 `DEMO-RB-20260817-0001`을 사용한다.
14. 보증서 `ESG-RB-20260817-0001`, 최종 재활용률 68%, 예상 탄소 절감 3.43kg CO2e로 마무리한다.

골든 흐름에서는 운영자 화면으로 전환해 주문 전 승인하지 않는다. 장인 판단은 수거 후 실물 검수 단계에서만 나타난다.

### PC 운영 콘솔

1. `/operations`를 열어 신청 목록과 단계별 관리자·장인 담당 표시를 확인한다.
2. 화면에 `RB-20260817-0001`로 표시되는 신청을 선택해 `/operations/30000000-0000-4000-8000-000000000001` 상세를 연다.
3. 현재 단계와 다음 단계 버튼을 확인하고 한 번 진행한 뒤 상태·안내 문구가 같은 신청에서 바뀌는지 확인한다.
4. 이 화면은 운영자 JWT로 실제 신청을 조회하고, 다음 단계 버튼은 v2 lifecycle command의 멱등 키·인접 전이 검증을 사용한다. API 오류나 빈 목록은 그대로 안내한다.

## 대표 예외 시연

- 카메라 권한 거부: 권한 안내 뒤 `기기에서 사진 선택`으로 복구한다.
- 사진 부족·형식·용량: JPG/JPEG·PNG, 필수 6면 6장, 장당 10MB 기준과 남은 슬롯을 안내한다.
- 사진 품질 미달: LIVE는 같은 6장 OpenAI Structured Output에서 실제 이미지 품질을 검사하고, 데모 모드는 준비된 품질 미달 Fixture를 사용할 수 있다. 어느 모드든 `422 IMAGE_QUALITY_INSUFFICIENT` 계약과 이미지별 재촬영 안내를 유지하며 품질 실패를 성공 분석으로 바꾸지 않는다.
- OpenAI/Meshy 제공자 오류: LIVE 분석 OpenAI 장애는 `modeUsed=DEMO_FIXTURE`인 호환 결과로 복구되고 결과 화면에 작게 `API오류로 인한 DEMO`를 표시한다. 직접 실행한 DEMO에는 이 문구가 없다. 이 non-LIVE 결과에 저장 profile이 없으면 목업 버튼에서만 OpenAI 4면 classifier 폴백이 가능하다. 반대로 `modeUsed=LIVE`인 기존 분석에 현재 profile이 없으면 409와 새 분석 안내를 표시하고 classifier로 재과금하지 않는다. Meshy 오류에는 전면 placeholder를 유지하고 유료 요청을 연속 클릭하지 않으며 동일 job token으로 상태를 재확인한다. source 3D 실패는 target 작업 실패로 표현하지 않는다.
- AI 비대상: `AI_INELIGIBLE`을 공식 가품 판정이 아니라 사진·정보 기반 사전 접수 불가로 표현한다.
- 변경 조건 거절: `CHANGE_APPROVAL_REQUIRED → CANCELED`와 Mock 결제 취소·환불 안내를 보여 준다.
- 제작 불가: `/orders/demo?stage=canceled&reason=production-unavailable`에서 `PRODUCTION_UNAVAILABLE → CANCELED`와 상담·Mock 환불 경로를 보여 준다.
- 권한: 현재 인증·RLS가 없는 데모 화면임을 밝힌다. 다른 고객 격리는 향후 API/Auth 연동 완료 조건으로 검증한다.
- 빈 상태: 수거·배송·보증서가 아직 없을 때 오류 대신 다음 단계와 조건을 설명한다.

## 실패 복구

| 실패 | 즉시 복구 |
|---|---|
| 카메라 권한·장치 오류 | 파일 선택 폴백 또는 준비한 필수 구도 JPG/PNG 6장 사용 |
| 사진 품질 미달 | 안내된 슬롯만 재촬영. 품질 오류를 Fixture 성공으로 위장하지 않음 |
| LIVE 분석 OpenAI 지연·오류 | `modeUsed=DEMO_FIXTURE` 호환 결과와 작은 `API오류로 인한 DEMO` 표기를 사용. 사진 품질 실패는 성공 Fixture로 바꾸지 않음 |
| 기존 LIVE 분석의 current profile 부재 | 409와 새 6면 분석 안내. 목업 단계 OpenAI classifier를 호출하지 않음 |
| non-LIVE profile 부재 | R5 연결 동의·기능 gate가 있을 때만 4면 classifier 호환 폴백. 동일 유료 job을 새로 만들지 않음 |
| Meshy 지연·오류 | 목업 전면 placeholder를 유지하고 동일 task token으로 조회. terminal provider create 실패는 재요청하지 않음 |
| 분석 화면 진행 지연 | 접수 ID를 유지한 준비된 `AI_COMPLETED` 상태로 이동 |
| 타임라인 진행 지연 | 빠른 데모 프로필 또는 준비된 상태 전이 사용 |
| 파생 텍스처 Storage 실패 | 전면 placeholder를 유지하고 같은 task token·멱등 키로 파생 자산을 다시 확인. 새 유료 job은 만들지 않음 |
| 변경 승인 처리 실패 | 준비된 `CHANGE_APPROVAL_REQUIRED`와 승인 완료 fixture로 복구 |
| 네트워크 불안정 | 로컬 Fixture로 주문·보증서까지 완주하고 실제 연동은 녹화로 보조 |

복구 중에 접수·주문·보증서 ID나 수치를 다른 시나리오 값으로 바꾸지 않는다.

## 사용자 카피 점검

- AI 화면: `사진 기반 AI 예상치`
- 정품 신호: `주문 적합 참고 신호이며 정품 확정이 아닙니다.`
- 주문 전 가격: `예상 제작비`
- 주문 전 제작 범위: `예상 제작 범위`
- 검수 변경: `주문 후 공식 장인 실물 검수 결과`
- 보증서 탄소: `예상 탄소 절감량`, `데모 산식`

`정품 인증 완료`, `제작 가능 확정`, `원단 재활용 확정`, `장인 승인 후 주문 가능`은 사용하지 않는다.

## 최종 체크리스트

- [ ] 실제 카메라 또는 파일 폴백으로 정면·후면·상단·하단·좌측면·우측면 사진을 모두 등록했다.
- [ ] 홈에서 실제 영상이 재생되고 `상품 진단하기` CTA가 제품 등록으로 이동한다.
- [ ] 하단 내비게이션은 `신청 내역`·`홈`·`마이페이지` 3개이며 `진행조회` 표기가 없다.
- [ ] `/orders` 신청 목록에서 상품을 선택하면 `/orders/demo` 상세가 열리고 진행·배송 점 사이 연결선이 유지된다.
- [ ] 카메라 왕복 후 사진과 제품 정보가 보존된다.
- [ ] JPG/JPEG·PNG, 필수 구도 6장, 장당 10MB 규칙이 UI와 계약에 일치한다.
- [ ] `/operations` 목록→상세→다음 단계 진행과 관리자·장인 담당 표시를 PC 폭에서 확인했다.
- [ ] 접수 `SUB-RB-20260817-0001`에서 72%·91% 예상치가 일관되게 표시된다.
- [ ] 추천 순위·사유가 실제 API 제품과 분석 정보를 반영하고, 여권지갑 목업은 완료 전 placeholder와 완료 후 맞춤 3D를 명확히 구분한다.
- [ ] 외부 texture 기능을 켠 경우 분석 접수의 R5 통합 동의, 저해상도 외관 4면 lookup·최종 6면 LIVE 분석과 private 4부위 profile 저장, 버튼 시작과 Meshy 상태 복구를 확인했다.
- [ ] current LIVE `EXTERIOR_PLAN`은 저장 profile을 재사용해 추가 OpenAI 호출·quota가 없고, profile 없는 LIVE 기존 분석은 409로 새 분석을 요구한다.
- [ ] OpenAI 4면 classifier는 profile 없는 non-LIVE 데모/seeded 경로에서만 실행된다.
- [ ] 최종 atlas는 `stitch-preserve-mask.png`를 우선 적용해 원본 스티치 RGB를 보존하며 PNG로 합성되고, 실제 적용 전에는 3D가 공개되지 않는다.
- [ ] 91%가 정품 확정이 아니라는 안내가 있다.
- [ ] Mock 결제 뒤 주문 `RB-20260817-0001`이 생성된다.
- [ ] 전문가 실물 검수는 `PRODUCT_RECEIVED` 뒤에만 나타난다.
- [ ] 변경 전후 72%→68%, 180,000원→195,000원, 4~5주와 변경 사유가 표시된다.
- [ ] 고객 승인 전에는 제작 상태로 이동하지 않는다.
- [ ] 승인 뒤 제작·품질·배송·완료가 같은 주문으로 이어진다.
- [ ] OpenAPI와 `mock-data.json`의 배송 Fixture가 `DEMO-RB-20260817-0001`, `DELIVERED`로 일치한다.
- [ ] `COMPLETED` 뒤 보증서 `ESG-RB-20260817-0001`, 68%, 3.43kg CO2e가 표시된다.
- [ ] 실제 외부 API 호출을 검증한 환경과 `DEMO_FIXTURE` 복구 경계를 발표자에게 공유했다.
- [ ] 비밀값·개인정보가 화면과 로그에 노출되지 않는다.
- [ ] 데모 값과 Mock 기능 표시를 확인했다.
