# 해커톤 데모 운영 가이드

## 데모 원칙

- 결제, 물류, 가격, 탄소 절감량, 정품 신호와 보증서는 데모용 데이터임을 화면과 발표에서 밝힌다.
- 실제 고객 데이터, 운영 키, 실물 거래나 법적 효력을 암시하는 표현을 사용하지 않는다.
- 정상 흐름 하나와 대표 예외 흐름 하나를 항상 준비한다.
- 외부 API가 실패해도 fixture 또는 hybrid 폴백으로 핵심 스토리를 끝낼 수 있어야 한다.

현재 `mcm-reborn/`은 Next.js scaffold 단계다. 아래 항목은 구현 완료를 주장하는 설명이 아니라 MVP 구현 후 통과해야 할 시연 준비·검수 기준이다.

## 사전 준비

1. 루트 `.env.example`을 앱의 `mcm-reborn/.env.local`로 복사하고 공개값과 서버 전용 값을 구분해 설정한다.
2. `supabase-schema.sql`을 적용하고 고객·운영자 데모 계정과 `profiles.role`을 준비한다.
3. `source-products` private bucket과 `catalog-assets` public bucket을 준비한다.
4. `mock-data.json`의 제품 이미지와 GLB·glTF 경로에 자산을 배치한다.
5. 정상, 검토 필요, 생산 불가 시나리오를 seed하거나 앱의 fixture loader로 불러온다.
6. 저장소 루트에서 `python validate_package.py`를 실행한다.
7. 고객과 운영자 브라우저 세션을 분리하고 화면 배율·네트워크를 확인한다.

서버 전용인 `SUPABASE_SERVICE_ROLE_KEY`와 `OPENAI_API_KEY`에는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

저장소 루트의 PowerShell에서 다음과 같이 앱 환경 파일을 준비한다.

```powershell
Copy-Item .\.env.example .\mcm-reborn\.env.local
```

앱 검증도 저장소 루트에서 실행한다.

```bash
npm --prefix mcm-reborn ci
npm --prefix mcm-reborn run lint
npm --prefix mcm-reborn run typecheck
npm --prefix mcm-reborn run build
```

현재 `package.json`에는 테스트 스크립트가 없다. `npm test` 통과를 표시하지 말고 아래 정상·예외 시나리오의 수동 검증 결과를 PR에 기록한다.

## 정상 시연 순서

1. 고객 로그인 후 가방 사진을 업로드한다.
2. 품질을 통과한 사진의 AI 분석에서 상태 등급, 재활용률·면적, 손상과 `NOT_EVALUATED` 신호를 설명한다.
3. 추천 제품 3종을 비교하고 한 제품의 3D 상세를 회전해 본다.
4. 신청과 가상 결제를 완료해 `PENDING_APPROVAL`을 보여 준다.
5. 운영자 화면으로 전환해 같은 신청을 열고 승인한다.
6. 고객 화면에서 시간 기반 제작·품질·배송 타임라인을 보여 준다.
7. 완료 신청의 ESG 보증서와 공개 검증 화면으로 마무리한다.

## 예외 시연

- 사진 품질 미달: `LOW_QUALITY_RECAPTURE`가 `422 IMAGE_QUALITY_INSUFFICIENT`와 이미지별 한국어 안내를 반환하고 성공 분석을 만들지 않는지 확인한다.
- OpenAI 제공자 오류: `AI_MODE=hybrid`에서 Fixture 폴백이 동작하고 응답의 분석 모드가 이를 드러내는지 확인한다.
- 정품 검토 필요: `CROSSBODY_HEAVY_WEAR`의 `REVIEW_REQUIRED`를 정품·가품 판정으로 표현하지 않는다. `PENDING` 수동 검토 건이 존재하고 신청 시 `422 AUTHENTICITY_REVIEW_REQUIRED`가 반환되며 신청·결제로 진입하지 않는지 확인한다.
- 수동 검토 완료 API·UI는 MVP에 없으므로 현장에서 임의로 해제하거나 승인하는 장면을 시연하지 않는다.
- 생산 불가: `PRODUCTION_UNAVAILABLE` 시나리오에서 고객에게 다음 행동을 안내한다.
- 권한: 고객이 다른 사용자의 분석·신청을 열 수 없음을 보여 준다.
- 빈 상태: 결제·배송·보증서가 아직 없을 때 오류 화면 대신 설명 가능한 빈 상태를 보여 준다.

## 실패 복구

| 실패 | 즉시 복구 |
|---|---|
| 사진 품질 미달 | 안내된 자산을 재촬영한다. Fixture 성공으로 우회하지 않음 |
| OpenAI 지연·오류 | `AI_MODE=hybrid` 또는 `fixture`로 전환하고 폴백임을 공개 |
| 타임라인 진행 지연 | `DEMO_TIMELINE_PROFILE=FAST_DEMO` 또는 준비된 정적 시나리오 사용 |
| 업로드·Storage 실패 | 사전 업로드한 데모 자산과 분석 Fixture 사용 |
| 운영자 세션 실패 | 별도 브라우저의 검증된 데모 계정으로 전환 |
| 네트워크 불안정 | 로컬 Fixture 경로로 정상 흐름을 끝내고 실제 연동 화면은 캡처로 보조 |

복구를 위해 계약, 실제 데이터나 보안 경계를 현장에서 임의로 바꾸지 않는다.

## 최종 체크리스트

- [ ] 고객 정상 흐름을 처음부터 끝까지 실행했다.
- [ ] 운영자 승인과 고객 상태 반영을 실행했다.
- [ ] 외부 제공자 실패와 권한 거부를 확인했다.
- [ ] 저품질 재촬영이 분석 미생성과 함께 동작한다.
- [ ] `REVIEW_REQUIRED`가 신청을 만들지 않고 수동 검토 대기를 안내한다.
- [ ] 모든 제품 상세의 이미지·3D 자산을 확인했다.
- [ ] 데모 수치와 Mock 기능 표시를 확인했다.
- [ ] 비밀값·개인정보가 화면과 로그에 노출되지 않는다.
- [ ] 폴백 전환과 원상 복구 방법을 발표자 모두 알고 있다.
