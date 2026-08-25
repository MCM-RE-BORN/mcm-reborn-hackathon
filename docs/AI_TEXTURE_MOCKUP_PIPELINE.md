# AI 분석·추천·외관 텍스처·3D 목업 파이프라인

> 기준일: 2026-08-21. 이 문서는 시연 MVP에 구현된 경계와 운영 전 보강을 구분한다. AI 결과는 사진 기반 예상이며 정품, 실제 소재 조성, 재단 위치, 색 정확도 또는 완성품을 보증하지 않는다.

## 1. 현재 시연 흐름

```text
정면·후면·상단·하단·좌측면·우측면 촬영/업로드
  -> 분석 접수 화면에서 R5 OpenAI 분석 + 이후 Meshy 외관 생성 통합 동의
  -> LIVE는 각 이미지 앞의 명시적 VIEW 라벨과 함께 2단계 위키 보강 분석
       ├─ 저해상도 외관 4면(전면·후면·좌측면·우측면)으로 관찰 가능한 검색어만 생성
       ├─ 서버의 검토된 18-claim 위키에서 최대 5개·4,000자 로컬 검색
       └─ 원본 6면 + 검색 결과로 사진 분석과 BODY/TRIM/STRAP/HARDWARE profile 생성
     또는 재현 가능한 non-LIVE Fixture
  -> 규칙 기반 재사용량·추천
  -> 목업 화면은 여권 지갑 전면 이미지 placeholder 표시
  -> 사용자가 3D 목업 생성 버튼을 누르면
       ├─ 현재 LIVE: private provider_result의 저장 profile을 소재 계획으로 결정론적 변환
       ├─ non-LIVE profile 부재: 외관 4면 OpenAI classifier 호환 폴백
       ├─ 선택 Meshy: 원제품 3D/PBR 생성(참고용, 비차단)
       └─ 외관 4면 Meshy 7: 여권 지갑 기존 UV를 유지한 목표 atlas 생성
  -> 검토된 exterior-mask와 stitch-preserve-mask로 PNG 합성
  -> 합성 atlas 적용이 끝나면 맞춤 @google/model-viewer 3D 공개
     또는 target 생성·조회·합성·적용의 최종 실패 시 로컬 데모 3D로 대체
```

MVP의 최종 대상은 `RE:BORN 여권 지갑` 외관 하나다. `BODY`가 필수 적용 대상이고 `TRIM`은 사진 근거가 충분할 때만 별도 후보로 분류한다. `STRAP`은 여권 지갑에 대응 부위가 없어 미적용하며 `HARDWARE`는 목표 모델의 기존 소재를 보존한다. 안감과 내부 소재는 타입, 프롬프트, 생성, UI에서 제외한다.

## 2. 분석과 추천

`LIVE` 분석은 공식 OpenAI JavaScript SDK와 Zod Structured Outputs를 사용한다. 6장 순서와 user message 라벨은 `0 FRONT`, `1 REAR`, `2 TOP`, `3 BOTTOM`, `4 LEFT`, `5 RIGHT`로 고정하고 각 `IMAGE_INDEX`/`VIEW` 텍스트 바로 다음에 해당 이미지를 둬 시점과 배열 위치가 어긋나지 않게 한다. 모델은 관찰 가능한 카테고리, 소재, 상태, 손상, 이미지 품질과 연속 영역 신호만 반환하며 재사용률, 면적, 추천 점수, 가격과 탄소 수치는 애플리케이션 규칙이 계산한다.

`MCM_REUSE_GUIDE_2026_08_21_V1`은 전달받은 소재·구성·재사용 참고 자료를 정규화한 짧은 prompt grounding이다. 공개 조사본 `MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1` 전체는 프롬프트나 앱 번들에 복사하지 않는다. build-time compiler가 사람이 검토한 시각 분석용 claim 18개와 필요한 출처만 서버 전용 스냅샷으로 만들며, 제품 예시·history·legal·care·sourcing·`context_only` 레코드는 분석 검색에서 제외한다.

LIVE 분석은 먼저 원래 6면 인덱스 중 `0 FRONT`, `1 REAR`, `4 LEFT`, `5 RIGHT`만 선택해 저해상도 외관 4면으로 관찰 가능한 일반 검색어를 만들고 서버 전용 `search_mcm_leather_wiki`를 정확히 한 번 호출한다. 상단·하단은 이 조회에서 제외하지만 상태·손상·사진 품질을 판정하는 최종 분석에는 6장 모두 유지한다. 결정론적 검색은 lexical hit가 있는 관련 claim만 최대 5개·4,000자 이하로 반환한다. Visetos 코팅 수지, microfiber suede, 캔버스 섬유 조성, 제작 공정, 패턴 실측값, Resetos, Vachetta에 대한 7개 금지 경계는 검색 순위와 무관하게 항상 최종 developer prompt에 포함한다. 제품·SKU 예시는 schema와 서버 양쪽에서 비활성이다. lookup은 `detail: low`, 최종 분석은 `detail: auto`를 사용해 두 단계 정확도를 유지하면서 첫 호출의 이미지 비용을 낮춘다. lookup 결과가 없거나 로컬 schema·검색·provider 5xx 오류이면 전체 코퍼스로 폴백하지 않고 사진과 always-on 안전 경계만으로 최종 분석을 계속한다. rate limit·quota·timeout·인증성 4xx는 같은 제한을 키우는 최종 6장 호출을 보내지 않고 canonical Fixture로 복구한다.

두 단계는 145초 absolute deadline 안에서 한 서버 프로세스의 분석 단위 FIFO로 실행한다. 최종 분석에 최소 65초를 먼저 예약하고, 남은 시간이 있을 때만 lookup을 35초·1회로 수행한다. 최종 Structured Output은 `max_completion_tokens=8192`로 제한하며 일시적 429·408·409·5xx·연결 오류·timeout을 deadline 안에서 한 번 재시도한다. 429는 `Retry-After` 또는 소진된 request/token/project-token bucket reset 중 긴 최소 대기와 jitter를 적용한다. quota·billing·spend·usage 한도와 일반 4xx는 재시도하지 않고 SDK 내부 재시도도 `0`으로 유지한다. 최종 실패는 canonical Fixture로 복구하며 결과 화면에는 `API오류로 인한 DEMO`를 작게 표시한다. allowlist 진단은 고객 조회 행이 아닌 서버 로그에만 남긴다. 이 FIFO와 cooldown은 같은 프로세스의 burst만 줄이므로 serverless 인스턴스 간 한도에는 분산 limiter가 별도로 필요하다.

결합 지식 버전은 PDF 버전, 런타임 retrieval corpus SHA-256, 검색기 버전과 v3 prompt 버전으로 구성하며 분석 request hash와 private `provider_result`에 기록한다. trace에는 lookup 요청 ID, query hash, 실제 조회 claim·source ID, 항상-on claim ID와 최종 context SHA-256만 남기고 자유 검색어 원문은 저장하지 않는다. 공개 KB의 URL·참고 이미지는 고객 요청 때 가져오거나 외부 모델에 보내지 않는다. 자세한 PDF 기준은 [`AI_ANALYSIS_DOMAIN_KNOWLEDGE.md`](./AI_ANALYSIS_DOMAIN_KNOWLEDGE.md), 위키 기준은 [런타임 위키 계약](./knowledge-base/mcm-leather-bags/RUNTIME_WIKI_KO.md)에 기록한다.

같은 Structured Output에서 `exteriorMaterialProfile`도 한 번에 생성한다. 정확히 `BODY`, `TRIM`, `STRAP`, `HARDWARE` 네 키를 사용하며 외관 근거 index는 FRONT `0`, REAR `1`, LEFT `4`, RIGHT `5`만 허용한다. 품질이 `ACCEPTABLE`인 LIVE 성공 결과는 `BODY=PRESENT`와 하나 이상의 직접 사진 근거를 가진 non-null profile이 필수다. profile은 외관 appearance 증거일 뿐 UV mask, mesh label, 재단 패턴 또는 픽셀 분할이 아니다.

profile, 결합 knowledge version, retrieval corpus·검색기 정보와 실제 조회 trace는 DB의 `analyses.provider_result`에 저장한다. 목업용 profile은 이 provenance가 현재 런타임 상수와 일치할 때만 재사용한다. 이 값은 목업 서버 경로만 읽는 private runtime context이며 고객용 `Analysis` 응답에는 직렬화하지 않는다. 분석의 요약·손상·예상치·추천 narrative는 기존 분석/추천 UI에서 별도로 보여 주고 목업 화면에는 반복하지 않는다.

추천은 제품의 필수 면적을 hard gate로 사용하고 면적 여유, 상태, 손상, 패턴 노출, 긴 스트립, 잔여 조각과 고객 희망 용도를 설명 가능한 점수로 합산한다. 이는 제작 BOM과 재단 패턴을 푸는 생산 최적화 ML이 아니라 시연용 휴리스틱이다.

## 3. 외관 4면과 소재 계획

브라우저는 촬영 `Blob`이나 base64 이미지를 다시 전송하지 않는다. 사용자가 목업 화면의 `3D 목업 생성` 버튼을 누르면 인증된 CUSTOMER가 내부 `/api/demo/texture-preview`에 `analysisId`, `jobKind`, 동의 버전과 멱등 메타데이터만 보내고, 서버가 분석 소유권과 분석 접수 시 연결된 R5 통합 동의를 먼저 확인한다. 분석 완료만으로 이 작업을 자동 시작하지 않는다.

현재 결합 지식 버전·retrieval corpus SHA·검색기·trace로 검증된 LIVE `exteriorMaterialProfile`이 있으면 `EXTERIOR_PLAN`은 이를 애플리케이션 규칙으로 즉시 변환한다. 이 경로는 외관 사진 signed URL 생성, idempotency/quota 예약과 추가 OpenAI 요청을 모두 건너뛰므로 OpenAI 호출이나 `EXTERIOR_PLAN` quota를 추가로 소비하지 않는다. 응답의 `provider: OPENAI`는 저장 profile의 출처 표기이지 목업 단계의 추가 provider 호출을 뜻하지 않는다.

`modeUsed=LIVE`인데 현재 profile이 없거나 과거 knowledge version인 기존 분석은 `409 EXTERIOR_MATERIAL_PROFILE_MISSING`으로 종료하고 새 6면 분석을 안내한다. 이 경우 목업 단계에서 OpenAI classifier로 자동 복구하거나 비용을 다시 발생시키지 않는다. `ExteriorMaterialClassifier`가 4면을 OpenAI로 다시 분류하는 호환 경로는 저장 profile이 없는 non-LIVE `DEMO_FIXTURE`/`SEEDED_ESTIMATE` 분석에만 사용한다. 이 호환 호출도 SDK 재시도는 `0`, 프로세스 FIFO와 bounded deadline, 일시적 429·408·409·5xx·연결 오류·timeout 최대 1회 재시도, quota 즉시 중단이라는 공통 OpenAI 정책을 사용한다. LIVE provider 장애 뒤 `modeUsed=DEMO_FIXTURE`로 저장된 데모 폴백도 이 non-LIVE 경계에 포함된다.

Meshy 작업 또는 non-LIVE classifier 폴백이 실제 외관 사진을 필요로 할 때만 서버가 `analysis_images`와 `media_assets`를 읽는다.

| Meshy/OpenAI 순서 | `display_order` | 촬영 슬롯 |
|---|---:|---|
| FRONT | 0 | 정면 |
| RIGHT | 5 | 우측면 |
| REAR | 1 | 후면 |
| LEFT | 4 | 좌측면 |

서버는 정확히 네 개의 서로 다른 `UPLOADED` JPEG/PNG, 고객 소유자, `source-products` bucket, 목적과 고객 폴더 경로를 검증하고 15분 signed URL을 만든다. 상단·하단은 제품 상태 분석에는 유지하지만 4-view 외관 생성에서는 제외한다.

`EXTERIOR_PLAN`은 저장 profile 변환 또는 허용된 non-LIVE OpenAI fallback에서 정확히 `BODY`, `TRIM`, `STRAP`, `HARDWARE` 네 부위를 반환한다. 각 부위에는 관찰 상태, 신뢰도, 근거 시점, 색·패턴·마감 설명과 적용 모드가 있다. `BODY`는 필수이며 항상 `GENERATE_SWATCH`다. `TRIM`은 충분히 관찰된 경우만 별도 swatch 후보, `STRAP`은 여권 지갑에서 제외, `HARDWARE`는 목표 PBR을 유지한다. 이 계획은 외관 appearance 계획이지 UV pixel mask나 mesh-face label이 아니다. 모든 결과는 다음 한계를 명시한다.

```text
semanticMask.status = UNAVAILABLE
semanticMask.reason = MESHY_DOES_NOT_RETURN_SEMANTIC_MASK
```

따라서 원제품 Meshy UV에서 부위를 픽셀 단위로 자동 분리했다고 설명하면 안 된다. 실제 배치의 유일한 semantic placement 기준은 아래의 사전 제작·검토된 canonical target UV mask 자산이며 AI가 런타임에 선택하거나 수정하지 않는다.

## 4. Meshy 작업 두 종류

한 번의 버튼 동작에서 두 작업을 모두 사용할 때는 필수 `TARGET_RETEXTURE`를 먼저 생성하고 task token을 저장한 뒤 선택형 `SOURCE_MODEL`을 요청한다. 30-credit 참고 작업이 먼저 provider 동시 실행 슬롯을 차지해 필수 목표 작업을 막지 않게 하며, source 생성 실패는 이미 접수된 target의 폴링·적용을 중단하지 않는다.

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

브라우저 합성은 AI가 적용 부위를 임의로 고르지 못하게 결정론적 target 자산을 사용해 다음 식을 항상 적용한다.

```text
effectiveMask = exteriorMask * (1 - stitchPreserveMask)
finalBaseColor = generatedTargetAtlas * effectiveMask
               + originalBaseColor * (1 - effectiveMask)
```

`compose-exterior-atlas.ts`가 manifest schema, 2048 크기와 SHA-256을 확인한 뒤 2048px Canvas에서 이 합성을 수행한다. 결과는 PNG로 인코딩해 보존 마스크가 255인 위치의 디코딩된 원본 base-color RGB가 JPEG 재압축으로 바뀌지 않게 한다. 이 PNG는 서버에 다시 전송하지 않고 `model-viewer`의 로컬 object URL로만 적용한다. 디코딩한 bitmap은 성공·실패와 무관하게 해제한다. `MockupViewer`는 로컬 canonical GLB의 `Material_0.baseColorTexture`에만 결과를 적용한다. 기존 normal과 metallic-roughness map은 유지하므로 스티치의 입체감, 금속 반응과 표면 디테일도 보존한다. 현 mask는 시연용 검토 자산이며 제조용 재단 SSOT는 아니다. 생산 전에는 DCC에서 UV island, body/trim/hardware material과 edge padding을 정식 검수해야 한다.

## 6. UI 상태와 복구

사용자는 AI 제공자별 버튼 대신 `3D 목업 생성` 버튼 하나를 사용한다. 분석 결과 카드, 외관 4면 목록, 소재 분류와 5단계 절차 설명은 목업 화면에 표시하지 않는다. 분석 요약·손상·예상치·추천 narrative는 분석/추천 화면의 책임으로 분리한다. 버튼을 누르기 전과 생성 중에는 여권 지갑 전면 이미지 placeholder를 유지하고 진행률과 최소 상태 문구만 표시한다. target 생성·폴링·보호 자산 다운로드·atlas 합성 또는 `model-viewer` 텍스처 적용이 재시도 뒤에도 실패하거나 Meshy 기능을 사용할 수 없으면, 외부 호출 없이 canonical `reborn-passport-wallet.glb`의 내장 base-color·normal·metallic-roughness와 스티치를 복구해 데모 3D 목업으로 대체하고 이를 화면에 명시한다. 이 UI 폴백은 provider 작업을 성공으로 바꾸거나 새 크레딧을 소비하지 않는다.

OpenAI 계획이나 source 3D가 비활성·실패해도 target 작업은 계속된다. Meshy가 명시적으로 거절한 HTTP 응답은 provider가 작업을 접수하지 않은 것으로 처리해 앱 예약을 해제한다. provider `429`는 잠시 후 다시 생성할 수 있지만, `402` 크레딧 부족과 인증·로컬 설정 오류는 `retryable: false`로 표시해 설정을 고치기 전 반복 요청을 막는다. 반면 생성 POST의 네트워크 단절, `408`, `5xx`, 성공처럼 보이지만 task ID를 검증할 수 없는 응답은 provider 접수 여부가 불명확하므로 중복 과금 방지를 위해 멱등 예약을 terminal lock으로 유지한다. 이미 발급된 token을 조회하는 GET polling의 네트워크·`408`·`5xx`와 `429`는 새 작업을 만들지 않으므로 같은 token으로 재시도한다. 최소 3초, provider 지시가 있으면 최대 60초를 기다리며 전체 transient 재시도는 20회로 제한하고 정상 상태 조회 80회와 분리한다. target 원격 작업이 `FAILED` 또는 `CANCELED`이면 같은 유료 작업을 새로 만들지 못하도록 terminal 상태와 token/key를 보존한다. 폴링 timeout, 파생 자산 저장 또는 로컬 합성 오류는 같은 token과 idempotency key로 재조회할 수 있다. 동일 task의 파생 경로는 결정적 hash를 사용해 이미 저장된 결과를 재사용한다. 맞춤 atlas와 `model-viewer` 적용이 성공하면 맞춤 3D를 공개하고, 최종 실패하면 내장 PBR·스티치 상태의 canonical GLB를 데모 3D로 공개한다. `기본 3D 모델과 비교`는 사용자 제공 Meshy GLB를 웹용으로 단순화·양자화하고 텍스처를 2K로 줄인 별도 비교 자산 `reborn-passport-wallet-base-comparison.glb`를 불러오며, `맞춤 외관 다시 적용`은 canonical GLB와 합성 atlas로 돌아간다. 원본은 3,039,371 triangles, 104,640,168 bytes, SHA-256 `e6c24eb068f79cfc5e97403fc80cc4fa922d46ba2002f5aadf87488e4d0b91b5`이며, 웹 파생 자산은 182,361 triangles, 7,596,184 bytes, SHA-256 `863c5297048f7a38d8f2f806d9b80dad81250cf8eb769ad1aa0d84f8c9a71d8b`다. 비교 전환은 추가 OpenAI·Meshy 작업을 만들지 않고, 비교 자산 로드 실패 시 맞춤 외관으로 자동 복귀한다.

## 7. 인증, 동의, 멱등성과 비용 상한

내부 경로는 인증된 `CUSTOMER`만 사용하며 분석 접근권한을 확인한다. 사용자는 분석 접수 화면의 `AI 분석을 위한 사진 활용 동의`에서 `MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R5` 통합 안내에 한 번 동의한다. 안내는 분석 접수 때 6장이 OpenAI로 전송되어 분석과 네 부위 profile을 함께 만든다는 점, 이후 버튼 클릭 때 저장 profile을 재사용하고 외관 4장이 Meshy로 전송된다는 점, 저장 profile이 없는 non-LIVE 분석에 한해 OpenAI 4면 classifier가 동작할 수 있다는 점, source GLB/PBR, 안감 제외, provider 보존과 결과 한계를 포함한다. 동의 시각, 고객, 분석과 안내 버전은 `analysis_external_ai_consents`에 연결해 기록한다.

분석 완료는 외관 작업 시작 신호가 아니다. 외관 작업은 사용자의 버튼 클릭으로만 시작하며 목업 화면에 별도 재동의 체크를 표시하지 않는다. texture service는 signed URL 생성, 멱등 예약과 외부 호출보다 먼저 고객·분석·R5 안내 버전이 일치하는 연결 동의 행을 조회한다. R4를 포함한 과거 안내 버전 또는 미동의 분석은 `403 FORBIDDEN`으로 종료한다.

작업은 서로 다른 `jobKind`를 사용한다.

| `jobKind` 경로 | 실제 provider 호출 | 분석당 생성 | 고객 UTC 일일 | 배포 UTC 일일 |
|---|---|---:|---:|---:|
| 현재 LIVE 저장 profile → `EXTERIOR_PLAN` | 없음(결정론적 변환) | 없음 | 없음 | 없음 |
| non-LIVE profile 부재 → `EXTERIOR_PLAN` | OpenAI | 1 | 3 | 5 |
| `SOURCE_MODEL` | Meshy | 1 | 1 | 2 |
| `TARGET_RETEXTURE` | Meshy | 1 | 기본 없음, 선택형 1~100 | 기본 없음, 선택형 1~100 |

`TARGET_RETEXTURE`의 앱 일일 한도는 기본 비활성이다. `MESHY_TARGET_RETEXTURE_DAILY_LIMIT_PER_USER` 또는 `MESHY_TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT`에 `1`~`100`을 넣을 때만 각각 고객·배포 전체 UTC 일일 안전 한도를 적용하며 빈값과 `0`은 비활성으로 해석한다. `SOURCE_MODEL`의 1/2와 non-LIVE `EXTERIOR_PLAN`의 3/5 고정 한도는 유지한다. 실제 크레딧과 provider 요청·동시 작업 제한은 Meshy의 `402`·`429` 응답을 권위 있는 상태로 취급한다.

서버 storage key는 non-LIVE classifier와 Meshy 작업에서 고객, 분석, jobKind와 provider를 기준으로 분석당 유료 작업을 한 번만 허용한다. request hash는 고객, 분석, jobKind, provider, 동의 버전과 네 source asset ID digest로 구성하며 브라우저가 발급한 idempotency key에는 의존하지 않는다. 따라서 같은 완료 요청은 새 탭에서도 plan 또는 signed task token을 재생하고, 진행 중 요청은 두 번째 provider 호출을 차단한다. 현재 LIVE 저장 profile 변환은 provider 예약 자체가 필요 없다. quota 행과 분리된 recovery receipt를 항상 먼저 예약하고, provider가 task를 접수했지만 기본 멱등 응답 저장이 실패하면 이 영수증에 signed task token을 보관해 다음 요청에서 같은 작업을 복구한다. 서버 전용 DB에 저장된 과거 receipt는 고객·분석·jobKind binding과 task ID를 다시 검증한 뒤 현재 secret과 새 만료 시각으로 재서명하므로 72시간 경과나 signing secret 교체가 새 유료 작업을 만들게 하지 않는다. 외부에서 제출된 token은 이 우회 경로를 사용하지 않고 항상 HMAC과 만료를 검증한다. 브라우저의 분석+jobKind별 key와 Meshy token `sessionStorage`, 동기 ref는 같은 탭에서 중복 클릭과 새로고침 복원을 빠르게 처리한다.

Meshy token은 고객, 분석, jobKind, provider task ID와 72시간 만료를 전용 `TEXTURE_TASK_SIGNING_SECRET` HMAC으로 서명한다. token은 암호문이 아니므로 URL query가 아니라 인증된 PUT body에만 보낸다. polling은 진행 중 Promise까지 합치는 짧은 in-process cache를 사용한다. provider `429`와 polling GET의 네트워크·`408`·`5xx`는 새 task를 생성하지 않고 같은 token으로 재조회한다. 대기 시간은 최소 3초이며 `Retry-After`가 더 길면 최대 60초까지 반영한다. 작업 전체 transient 재시도는 20회로 제한하되 정상 상태 조회 80회에서는 차감하지 않는다. 이는 서버리스 인스턴스 간 분산 rate limit이나 durable queue를 대체하지 않는다.

## 8. 환경 변수

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://demo.example.com

OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.6
AI_MODE=DEMO_FIXTURE
ENABLE_EXTERNAL_AI=false
EXTERNAL_AI_PRIVACY_NOTICE_VERSION=MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R5
NEXT_PUBLIC_EXTERNAL_AI_PRIVACY_NOTICE_VERSION=MCM_EXTERNAL_AI_ANALYSIS_TEXTURE_2026_08_21_R5

ENABLE_TEXTURE_AI=false
MESHY_API_KEY=
TEXTURE_TASK_SIGNING_SECRET=
MESHY_MOCKUP_MODEL_URL=https://demo.example.com/assets/models/reborn-passport-wallet.glb

# 선택형 TARGET_RETEXTURE 앱 UTC 일일 안전 한도. 빈값 또는 0은 비활성, 유효 범위 1~100
MESHY_TARGET_RETEXTURE_DAILY_LIMIT_PER_USER=
MESHY_TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT=

# 선택형 30-credit 참고 source GLB/PBR
ENABLE_MESHY_SOURCE_MODEL=false
MESHY_SOURCE_MODEL=meshy-7
```

- `ENABLE_TEXTURE_AI=true`가 공통 opt-in이다.
- LIVE 분석은 `AI_MODE=LIVE`, `ENABLE_EXTERNAL_AI=true`, OpenAI key/model과 통합 R5 서버 안내 버전이 모두 일치해야 한다. 클라이언트는 같은 고정 버전을 분석 동의 영수증에 사용한다.
- 현재 capability 계산상 `EXTERIOR_PLAN`에는 `OPENAI_API_KEY`가 필요하고 같은 key/model은 최초 LIVE 분석에도 사용한다. 다만 current LIVE 저장 profile 경로는 이를 다시 호출하거나 quota를 소비하지 않으며, 목업 단계에서 새 OpenAI 요청을 만드는 것은 non-LIVE classifier 호환 폴백뿐이다.
- `TARGET_RETEXTURE`는 Meshy key, 32자 이상의 고엔트로피 signing secret, Meshy가 접근할 공개 HTTPS GLB URL이 필요하다.
- `TARGET_RETEXTURE` 앱 일일 한도는 기본 비활성이며 두 `MESHY_TARGET_RETEXTURE_*` 값에 `1`~`100`을 설정한 범위만 UTC 날짜별로 적용한다. 빈값과 `0`은 비활성이다.
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
- [Meshy Rate Limits](https://docs.meshy.ai/en/api/rate-limits)
- [Meshy API Errors](https://docs.meshy.ai/en/api/errors)
- [Meshy Account Balance](https://docs.meshy.ai/en/api/balance)
- [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)
- [Meshy Asset Retention](https://docs.meshy.ai/en/api/asset-retention)
- [`<model-viewer>` Materials & Scene](https://modelviewer.dev/examples/scenegraph/)
