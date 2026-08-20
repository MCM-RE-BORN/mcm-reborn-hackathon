# AI 분석·추천·외관 텍스처·3D 목업 파이프라인

> 기준일: 2026-08-21. 이 문서는 시연 MVP에 구현된 경계와 운영 전 보강을 구분한다. AI 결과는 사진 기반 예상이며 정품, 실제 소재 조성, 재단 위치, 색 정확도 또는 완성품을 보증하지 않는다.

## 1. 현재 시연 흐름

```text
정면·후면·상단·하단·좌측면·우측면 촬영/업로드
  -> 분석 접수 화면에서 OpenAI 분석 + 이후 Meshy 외관 생성 통합 동의
  -> OpenAI 구조화 비전 분석 또는 재현 가능한 Fixture
  -> 규칙 기반 재사용량·추천
  -> 목업 화면은 여권 지갑 전면 이미지 placeholder 표시
  -> 사용자가 외관 목업 생성 버튼을 누르면 외관 4면 선택
       정면 -> 우측면 -> 후면 -> 좌측면
       ├─ OpenAI: BODY/TRIM/STRAP/HARDWARE 외관 소재 계획
       ├─ 선택 Meshy: 원제품 3D/PBR 생성(참고용, 비차단)
       └─ Meshy 7: 여권 지갑 기존 UV를 유지한 목표 atlas 생성
  -> 검토된 exterior-mask와 stitch-preserve-mask로 PNG 합성
  -> 합성 atlas 적용이 끝난 뒤에만 @google/model-viewer 3D 공개
```

MVP의 최종 대상은 `RE:BORN 여권 지갑` 외관 하나다. `BODY`가 필수 적용 대상이고 `TRIM`은 사진 근거가 충분할 때만 별도 후보로 분류한다. `STRAP`은 여권 지갑에 대응 부위가 없어 미적용하며 `HARDWARE`는 목표 모델의 기존 소재를 보존한다. 안감과 내부 소재는 타입, 프롬프트, 생성, UI에서 제외한다.

## 2. 분석과 추천

`LIVE` 분석은 공식 OpenAI JavaScript SDK와 Zod Structured Outputs를 사용한다. 6장 순서는 정면, 후면, 상단, 하단, 좌측면, 우측면이다. 모델은 관찰 가능한 카테고리, 소재, 상태, 손상, 이미지 품질과 연속 영역 신호만 반환하며 재사용률, 면적, 추천 점수, 가격과 탄소 수치는 애플리케이션 규칙이 계산한다.

`MCM_REUSE_GUIDE_2026_08_21_V1`은 전달받은 소재·구성·재사용 참고 자료를 정규화한 prompt grounding이다. 사진 증거를 대체하거나 제품 계열, 진위, 숨은 소재를 추정하는 근거로 사용하지 않는다. 자세한 기준은 [`AI_ANALYSIS_DOMAIN_KNOWLEDGE.md`](./AI_ANALYSIS_DOMAIN_KNOWLEDGE.md)에 기록한다.

추천은 제품의 필수 면적을 hard gate로 사용하고 면적 여유, 상태, 손상, 패턴 노출, 긴 스트립, 잔여 조각과 고객 희망 용도를 설명 가능한 점수로 합산한다. 이는 제작 BOM과 재단 패턴을 푸는 생산 최적화 ML이 아니라 시연용 휴리스틱이다.

## 3. 외관 4면과 소재 계획

브라우저는 촬영 `Blob`이나 base64 이미지를 다시 전송하지 않는다. 사용자가 목업 화면의 `외관 목업 생성` 버튼을 누르면 인증된 CUSTOMER가 내부 `/api/demo/texture-preview`에 `analysisId`와 `jobKind`만 보내고, 서버가 분석 소유권과 분석 접수 시 연결된 통합 동의를 먼저 확인한 뒤 `analysis_images`와 `media_assets`를 읽는다. 분석 완료만으로 이 작업을 자동 시작하지 않는다.

| Meshy/OpenAI 순서 | `display_order` | 촬영 슬롯 |
|---|---:|---|
| FRONT | 0 | 정면 |
| RIGHT | 5 | 우측면 |
| REAR | 1 | 후면 |
| LEFT | 4 | 좌측면 |

서버는 정확히 네 개의 서로 다른 `UPLOADED` JPEG/PNG, 고객 소유자, `source-products` bucket, 목적과 고객 폴더 경로를 검증하고 15분 signed URL을 만든다. 상단·하단은 제품 상태 분석에는 유지하지만 4-view 외관 생성에서는 제외한다.

`EXTERIOR_PLAN`은 OpenAI Structured Outputs로 정확히 `BODY`, `TRIM`, `STRAP`, `HARDWARE` 네 부위를 반환한다. 각 부위에는 관찰 상태, 신뢰도, 근거 시점, 색·패턴·마감 설명과 적용 모드가 있다. 이 계획은 외관 appearance 계획이지 UV pixel mask나 mesh-face label이 아니다. 모든 결과는 다음 한계를 명시한다.

```text
semanticMask.status = UNAVAILABLE
semanticMask.reason = MESHY_DOES_NOT_RETURN_SEMANTIC_MASK
```

따라서 원제품 Meshy UV에서 부위를 픽셀 단위로 자동 분리했다고 설명하면 안 된다.

## 4. Meshy 작업 두 종류

### 4.1 `SOURCE_MODEL`

선택 기능이다. Meshy Multi-Image to 3D에 FRONT, RIGHT, REAR, LEFT 네 signed URL을 전달하고 Meshy 7, texture, PBR, 2K, GLB 출력을 요청한다. 결과의 용도는 `REFERENCE_ONLY`다.

- 원제품 외관이 한 물체로 복원됐는지 확인하는 참고 자료다.
- source GLB의 UV는 목표 여권 지갑 UV와 대응하지 않는다.
- source GLB/PBR 성공 여부는 `TARGET_RETEXTURE`를 시작하거나 완료하는 조건이 아니다.
- source GLB와 작업별 세부 결과는 고객 UI에 노출하지 않으며 최종 여권 지갑 모델로 교체하지 않는다.
- 비용이 큰 작업이라 `ENABLE_MESHY_SOURCE_MODEL=true`를 별도로 설정해야 한다.

### 4.2 `TARGET_RETEXTURE`

필수 외관 생성 작업이다. Meshy Retexture에 공개 HTTPS 여권 지갑 GLB와 동일한 외관 4면을 전달한다.

```json
{
  "ai_model": "meshy-7",
  "enable_original_uv": true,
  "enable_pbr": true,
  "multiview_image_urls": ["FRONT", "RIGHT", "REAR", "LEFT"],
  "target_formats": ["glb"],
  "texture_resolution": "2k"
}
```

멀티뷰 입력은 Meshy 7로 고정한다. 성공한 원격 GLB를 최종 결과로 표시하지 않으며 Meshy `textureUrl`도 브라우저에 노출하지 않는다. 인증된 내부 asset 경로가 task token의 고객·분석·`TARGET_RETEXTURE` binding과 성공 상태를 재검증한 뒤, 허용된 `meshy.ai` host에서 base-color를 내려받아 private `source-products/<customerId>/texture-previews/<analysisId>/` 파생 경로에 보관한다. 리다이렉트도 매 hop마다 `meshy.ai` host인지 검증하고 실제 응답을 1 byte 이상 8 MiB 이하, JPEG/PNG MIME과 image signature로 제한한다. 현재 bucket 정책상 WebP는 저장하지 않고 명시적으로 거부한다. 브라우저에는 5분짜리 Supabase signed URL만 반환한다.

## 5. 여권 지갑 소재 맵과 결정론적 합성

현재 GLB는 `Material_0` 하나와 UV0, base-color, normal, metallic-roughness map을 가진다. 단일 material만 바꾸면 지퍼와 금속까지 AI 색으로 덮이므로 다음 자산을 GLB에서 추출해 고정했다.

```text
public/assets/models/reborn-passport-wallet/
  original-base-color.jpg
  original-normal.jpg
  original-metallic-roughness.jpg
  exterior-mask.png
  stitch-preserve-mask.png
  material-id-map.png
  material-assets.json
```

`exterior-mask.png`와 `stitch-preserve-mask.png`는 모두 2048×2048 UV와 정렬된다. 외관 마스크의 흰색은 교체 후보 외피이고, 스티치 보존 마스크의 흰색은 원본 base-color의 스티치와 인접한 어두운 디테일을 강제로 유지한다. 두 마스크가 중복되더라도 스티치 보존 마스크가 우선한다. 현재 source GLB, 원본 PBR map, 두 mask와 material ID map의 checksum 및 각 coverage는 `material-assets.json`에 기록한다. 생성 스크립트는 `mcm-reborn/scripts/build-passport-wallet-material-assets.py`이며 2048 정렬, checksum, GLB 구조와 검토된 coverage 범위가 달라지면 실패한다.

브라우저 합성은 AI가 적용 부위를 임의로 고르지 못하게 다음 식을 항상 적용한다.

```text
effectiveMask = exteriorMask * (1 - stitchPreserveMask)
finalBaseColor = generatedTargetAtlas * effectiveMask
               + originalBaseColor * (1 - effectiveMask)
```

`compose-exterior-atlas.ts`가 manifest schema, 2048 크기와 SHA-256을 확인한 뒤 2048px Canvas에서 이 합성을 수행한다. 결과는 PNG로 인코딩해 보존 마스크가 255인 위치의 디코딩된 원본 base-color RGB가 JPEG 재압축으로 바뀌지 않게 한다. 이 PNG는 서버에 다시 전송하지 않고 `model-viewer`의 로컬 object URL로만 적용한다. 디코딩한 bitmap은 성공·실패와 무관하게 해제한다. `MockupViewer`는 로컬 canonical GLB의 `Material_0.baseColorTexture`에만 결과를 적용한다. 기존 normal과 metallic-roughness map은 유지하므로 스티치의 입체감, 금속 반응과 표면 디테일도 보존한다. 현 mask는 시연용 검토 자산이며 제조용 재단 SSOT는 아니다. 생산 전에는 DCC에서 UV island, body/trim/hardware material과 edge padding을 정식 검수해야 한다.

## 6. UI 상태와 복구

사용자는 AI 제공자별 버튼 대신 `외관 목업 생성` 버튼 하나를 사용한다. 분석 결과 카드, 외관 4면 목록, 소재 분류와 5단계 절차 설명은 목업 화면에 표시하지 않는다. 버튼을 누르기 전, 생성 중, 원격 작업 또는 로컬 적용 실패 상태에는 모두 여권 지갑 전면 이미지 placeholder를 유지한다. 생성 중에는 placeholder 위의 진행률과 최소 상태 문구만 표시한다.

OpenAI 계획이나 source 3D가 비활성·실패해도 target 작업은 계속된다. target 원격 작업이 `FAILED` 또는 `CANCELED`이면 같은 유료 작업을 새로 만들지 못하도록 terminal 상태와 token/key를 보존한다. 폴링 timeout, 파생 자산 저장 또는 로컬 합성 오류는 같은 token과 idempotency key로 재조회할 수 있다. 동일 task의 파생 경로는 결정적 hash를 사용해 이미 저장된 결과를 재사용한다. 목표 atlas 합성뿐 아니라 `model-viewer`의 `baseColorTexture` 적용까지 성공해 `applied` 상태가 된 뒤에만 3D 레이어를 공개한다. 그 뒤에는 원본 canonical GLB와 맞춤 외관을 비교할 수 있다.

## 7. 인증, 동의, 멱등성과 비용 상한

내부 경로는 인증된 `CUSTOMER`만 사용하며 `getAnalysisById`로 분석 접근권한을 확인한다. 사용자는 분석 접수 화면에서 `MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R4` 통합 안내에 한 번 동의한다. 안내는 LIVE 분석을 위한 OpenAI 전송과, 이후 사용자가 목업 화면 버튼을 누를 때 외관 4면을 OpenAI/Meshy로 전송해 비용성 작업을 즉시 시작한다는 사실, source GLB/PBR, 안감 제외, provider 보존과 결과 한계를 포함한다. 동의 시각, 고객, 분석과 안내 버전은 `analysis_external_ai_consents`에 연결해 기록한다.

분석 완료는 외관 작업 시작 신호가 아니다. 외관 작업은 사용자의 버튼 클릭으로만 시작하며 별도 재동의 체크는 표시하지 않는다. texture service는 provider 설정 확인, signed URL 생성, 멱등 예약과 외부 호출보다 먼저 고객·분석·R4 안내 버전이 일치하는 연결 동의 행을 조회한다. 과거 안내 버전 또는 미동의 분석은 `403 FORBIDDEN`으로 종료한다.

작업은 서로 다른 `jobKind`를 사용한다.

| `jobKind` | provider | 분석당 생성 | 고객 UTC 일일 | 배포 UTC 일일 |
|---|---|---:|---:|---:|
| `EXTERIOR_PLAN` | OpenAI | 1 | 3 | 5 |
| `SOURCE_MODEL` | Meshy | 1 | 1 | 2 |
| `TARGET_RETEXTURE` | Meshy | 1 | 3 | 5 |

서버 storage key는 고객, 분석, jobKind와 provider를 기준으로 분석당 유료 작업을 한 번만 허용한다. request hash는 고객, 분석, jobKind, provider, 동의 버전과 네 source asset ID digest로 구성하며 브라우저가 발급한 idempotency key에는 의존하지 않는다. 따라서 같은 완료 요청은 새 탭에서도 plan 또는 signed task token을 재생하고, 진행 중 요청은 두 번째 provider 호출을 차단한다. 브라우저의 분석+jobKind별 key와 Meshy token `sessionStorage`, 동기 ref는 같은 탭에서 중복 클릭과 새로고침 복원을 빠르게 처리한다.

Meshy token은 고객, 분석, jobKind, provider task ID와 72시간 만료를 전용 `TEXTURE_TASK_SIGNING_SECRET` HMAC으로 서명한다. token은 암호문이 아니므로 URL query가 아니라 인증된 PUT body에만 보낸다. polling은 진행 중 Promise까지 합치는 짧은 in-process cache를 사용한다. 이는 서버리스 인스턴스 간 분산 rate limit이나 durable queue를 대체하지 않는다.

## 8. 환경 변수

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://demo.example.com

OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.6
EXTERNAL_AI_PRIVACY_NOTICE_VERSION=MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R4
NEXT_PUBLIC_EXTERNAL_AI_PRIVACY_NOTICE_VERSION=MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R4

ENABLE_TEXTURE_AI=false
MESHY_API_KEY=
TEXTURE_TASK_SIGNING_SECRET=
MESHY_MOCKUP_MODEL_URL=https://demo.example.com/assets/models/reborn-passport-wallet.glb

# 선택형 30-credit 참고 source GLB/PBR
ENABLE_MESHY_SOURCE_MODEL=false
MESHY_SOURCE_MODEL=meshy-7
```

- `ENABLE_TEXTURE_AI=true`가 공통 opt-in이다.
- LIVE 분석의 서버 안내 버전은 통합 R4와 일치해야 한다. 클라이언트는 같은 고정 버전을 분석 동의 영수증에 사용한다.
- `EXTERIOR_PLAN`은 `OPENAI_API_KEY`가 있어야 한다. 모델은 `OPENAI_VISION_MODEL`을 공유한다.
- `TARGET_RETEXTURE`는 Meshy key, 32자 이상의 고엔트로피 signing secret, Meshy가 접근할 공개 HTTPS GLB URL이 필요하다.
- `MESHY_MOCKUP_MODEL_URL`이 없으면 HTTPS `NEXT_PUBLIC_APP_URL` 아래의 기본 GLB URL을 조합한다. localhost, 사설 IP, `.glb`가 아닌 URL은 허용하지 않는다.
- source 3D는 `ENABLE_MESHY_SOURCE_MODEL=true`일 때만 capability에 노출한다.
- 비밀값에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## 9. 보존·비용·운영 전 보강

- OpenAI API 콘텐츠는 기본 abuse-monitoring 정책에서 최대 30일 보관될 수 있다. 계정별 data control을 배포 전에 확인한다.
- Meshy API asset은 비 Enterprise 계정에서 최대 3일 보존된다. target atlas는 성공 시 소유 Storage에 복사하므로 재사용할 수 있지만 source GLB는 아직 복사하지 않아 provider 만료 뒤 복구할 수 없다.
- 2026-08-21 공식 표 기준 2K/4K Multi-Image textured source는 30 credits, Retexture는 10 credits다. 두 Meshy 단계를 모두 켜면 분석 하나에 40 credits가 필요하다. Pro 계정과 API credit 잔액은 별개로 확인한다.
- idempotency row와 consent row 자동 purge, 월 금액 budget, provider webhook, 분산 poll throttle은 아직 없다.
- target atlas는 기존 private `source-products` bucket의 분리된 `texture-previews` namespace를 임시로 공유한다. 원본 `media_assets` 행과는 연결하지 않으며, 운영 전에는 파생 자산 전용 bucket과 자동 삭제·보존 정책으로 분리해야 한다.
- 운영용 GLB는 BODY, TRIM, HARDWARE를 별도 named material로 재제작하고 PBR/UV 품질 gate와 사람 승인을 거쳐야 한다.

`/api/demo/texture-preview`는 OpenAPI v2의 장기 제품 계약에 포함하지 않은 시연용 내부 경로다. durable job, 파생 자산 삭제·재생성 정책과 운영 API로 승격할 때는 별도 계약 변경이 필요하다.

## 10. `@google/model-viewer`를 유지하는 이유

최종 요구는 canonical GLB를 회전·확대하고 검증된 base-color atlas를 한 material에 적용하는 것이다. `@google/model-viewer`가 GLB 로딩, 모바일 카메라 컨트롤, 로딩/오류 상태와 Materials API를 제공하므로 직접 렌더 루프와 glTF 자원 수명을 구현할 필요가 없다.

패널을 직접 선택하고 UV를 이동·회전하거나 shader에서 실시간 다중 mask를 편집해야 할 때만 Three.js 기반 편집기를 별도 도입한다. 서버/DCC가 최종 GLB를 bake하는 구조에서도 표시 단계는 계속 `model-viewer`로 유지할 수 있다.

## 11. 공식 참고 자료

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data)
- [Meshy Multi-Image to 3D](https://docs.meshy.ai/en/api/multi-image-to-3d)
- [Meshy Retexture](https://docs.meshy.ai/en/api/retexture)
- [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)
- [Meshy Asset Retention](https://docs.meshy.ai/en/api/asset-retention)
- [`<model-viewer>` Materials & Scene](https://modelviewer.dev/examples/scenegraph/)
