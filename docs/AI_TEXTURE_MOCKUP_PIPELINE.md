# AI 분석·추천·텍스처·3D 목업 파이프라인

> 기준일: 2026-08-21. 이 문서는 시연 MVP에 실제로 구현된 경계와 운영 서비스 전에 필요한 보강을 구분한다. AI 결과와 목업은 사진 기반 예상이며 정품, 재단 가능 위치, 색 정확도 또는 완성품을 보증하지 않는다.

## 1. 목표와 현재 범위

이 파이프라인은 한 고객 분석을 다음 순서로 연결한다.

```text
6면 촬영/업로드
  -> OpenAI 구조화 비전 분석 또는 재현 가능한 Fixture
  -> 애플리케이션 규칙 기반 재사용량·추천 점수
  -> 브라우저의 결정론적 소재 크롭·미러 타일
  -> 선택: OpenAI 이미지 편집으로 텍스처 보정
  -> 선택: Meshy로 여권지갑 GLB 리텍스처
  -> @google/model-viewer에서 원본/맞춤 목업 비교
```

| 기능 | 시연 MVP 구현 | 운영 서비스에 추가로 필요 |
|---|---|---|
| 제품 분석 | 7개 지정 구도 이미지를 OpenAI Structured Outputs로 분석하는 `LIVE`, 재현 가능한 `DEMO_FIXTURE`·`SEEDED_ESTIMATE`, 품질 미달·제공자 실패 처리 | 실제 촬영 품질 평가 데이터셋, 모델 평가·버전 승격, 사람 검수 및 공식 진위 판정 서비스 분리 |
| 추천 | 재사용 가능 면적을 hard gate로 사용하고 상태, 손상도, 소재, 패턴 노출, 긴 스트립, 잔여 조각 활용, 희망 용도를 점수와 사유 코드에 반영 | 실제 제작 BOM·재단 패턴·재고·공정 능력·원가를 반영한 버전형 최적화와 오프라인 평가 |
| 텍스처 추출 | 브라우저에서 원본 중앙 소재 영역을 크롭하고 반복 가능한 미러 타일을 생성 | 제품/배경/금속/봉제선 분할, 렌즈·원근·조명·색 보정, 실제 크기 추정, 저작권·상표 검토 |
| 텍스처 제작 | 로컬 결정론적 텍스처와 선택형 OpenAI `gpt-image-2` 이미지 편집 | 색상 표준, 물리 단위, 패널별 마스크, PBR 채널 품질 평가, 재생성·승인 이력 |
| 3D 결합 | 로컬 GLB의 base-color 교체 또는 Meshy 비동기 2K 리텍스처 결과 GLB 표시 | 소유 스토리지, 영속 job/queue, 패널별 UV·material, 결과 승인·버전·삭제 정책 |
| 뷰어 | `@google/model-viewer`의 카메라 컨트롤과 Materials API 사용 | 패널 편집기·UV 조작·실시간 베이킹이 필요할 때 별도 Three.js/DCC 도구 도입 검토 |

`/api/demo/texture-preview`는 인증된 `CUSTOMER`만 사용하는 시연용 내부 경로다. 현재 OpenAPI v2의 장기 제품 계약에는 포함하지 않았으며, 운영 API로 승격할 때는 별도 계약 변경 절차가 필요하다.

## 2. 구현 흐름

### 2.1 제품 분석

`LIVE` 분석은 서버의 공식 OpenAI JavaScript SDK로 7개 이미지 URL을 정면, 후면, 상단, 하단, 좌측면, 우측면, 일련번호 순서로 전달한다. 응답은 Zod 기반 Structured Outputs로 검증한다. 모델은 관찰 가능한 카테고리, 소재, 상태, 손상, 이미지 품질, 긴 스트립 가능성 및 주문 적합 참고 신호만 반환한다. 재사용률, 면적, 가격, 추천, 탄소 수치는 모델이 만들지 않고 애플리케이션 규칙이 계산한다. Structured Outputs의 목적과 스키마 준수 방식은 [OpenAI 공식 문서](https://developers.openai.com/api/docs/guides/structured-outputs)를 기준으로 한다.

외부 분석은 `AI_MODE=LIVE`, 배포 opt-in, 서버 키, 고정된 개인정보 안내 버전, 요청별 고객 동의가 모두 있어야 실행된다. OpenAI 장애 시에는 검증된 Fixture로 폴백할 수 있지만, 이미지 품질 미달 `422 IMAGE_QUALITY_INSUFFICIENT`를 성공 Fixture로 바꾸지는 않는다. `DEMO_FIXTURE`와 `SEEDED_ESTIMATE`는 실제 업로드 사진을 판독한 결과가 아니므로 화면의 mode/provider 표시를 유지한다.

### 2.2 분석 정보 기반 추천

추천은 저장된 활성 제품 각각에 대해 다음을 계산하고 점수순으로 제공한다.

- 예상 재사용 가능 면적이 제품의 `requiredAreaCm2`보다 작으면 `INSUFFICIENT_AREA`로 제외한다.
- 면적 여유, 상태 등급, 전체 손상도와 저손상 영역 가능성을 점수화한다.
- 코팅 캔버스·가죽의 패턴 가시성, 작은 잔여 조각 활용, 네임택용 긴 스트립 가능성을 반영한다.
- 고객의 희망 용도 일치는 가산점이며 제작 가능 여부를 뒤집는 hard gate가 아니다.
- API의 실제 제품, 순위, 점수, 사유 코드와 필요 면적을 UI에 표시한다. 현재 목업 상세는 `RE:BORN 여권지갑`만 연결한다.

이 점수는 설명 가능한 데모 휴리스틱이다. 실제 생산 최적화나 개인화 ML 모델이라고 표현하지 않는다.

### 2.3 결정론적 로컬 텍스처

외부 API 없이도 핵심 시연이 끝나도록 브라우저에서 다음 처리를 한다.

1. 촬영 세션의 후면 사진을 우선하고 없으면 정면 사진, 직접 진입이면 가상 데모 자산을 사용한다.
2. 짧은 변 길이의 중앙 62%를 정사각형으로 잘라 512×512 JPEG로 만든다.
3. 이 조각을 가로·세로로 번갈아 반전한 4×4 타일로 배치해 1024×1024 JPEG를 만든다.
4. 결과는 브라우저 `Blob`과 object URL로만 다루며 외부 전송은 하지 않는다.

미러 타일은 경계의 급격한 단절을 줄이는 결정론적 데모 처리일 뿐, 소재 반복 주기나 실물 재단 스케일을 복원하지 않는다.

### 2.4 선택형 OpenAI 텍스처 보정

고객이 별도 외부 처리 동의를 체크하고 버튼을 누른 경우에만 중앙 크롭 JPEG를 서버로 보낸다. 서버는 JPEG/PNG data URL, 실제 magic byte, 2MB 한도를 검증한 뒤 OpenAI Images Edit를 호출한다. 기본 `OPENAI_IMAGE_MODEL=gpt-image-2`는 이미지 입력과 편집 endpoint를 지원한다. 현재 요청은 1024×1024, medium 품질, JPEG 출력을 사용하고 소재 색·결·모티프를 보존하면서 조명, 배경, 하드웨어, 원근과 반복 경계를 정리하도록 제한한다. 모델 기능은 [GPT Image 2 공식 문서](https://developers.openai.com/api/docs/models/gpt-image-2)를 기준으로 한다.

생성 JPEG는 로컬 GLB의 base-color texture로 적용한다. AI가 만든 결과이므로 로고, 패턴 간격, 색 또는 마모를 정확히 복원한다고 보장하지 않는다. 현재 결과는 시연용 idempotency 응답 캐시에만 들어가며 제품 자산으로 영속 저장되지 않는다.

### 2.5 선택형 Meshy 리텍스처

고객이 명시적으로 Meshy 버튼을 누르면 서버가 여권지갑 GLB와 스타일 이미지를 Meshy Retexture API에 전달한다. 스타일은 OpenAI 보정 결과가 있으면 그것을, 없으면 로컬 미러 타일을 사용한다. 현재 설정은 `enable_original_uv=true`, `enable_pbr=true`, `texture_resolution=2k`, `target_formats=["glb"]`다. Meshy는 작업 ID를 반환하고 앱은 상태를 폴링해 성공한 GLB를 `@google/model-viewer`에 교체한다. 공개 URL 또는 data URI 입력, 기존 UV 유지, PBR 출력과 비동기 작업 형식은 [Meshy Retexture API 문서](https://docs.meshy.ai/en/api/retexture)를 기준으로 한다.

원시 작업 ID만으로 상태를 조회할 수 없게 서버가 고객 ID·분석 ID에 묶인 서명 task token을 발급한다. token payload는 암호화된 비밀이 아니지만 전용 `TEXTURE_TASK_SIGNING_SECRET`으로 변조를 검증하며, 서버가 로그인 고객·분석 소유권을 다시 확인한다. 브라우저는 분석별 `sessionStorage`에 token을 보관해 새로고침 뒤 폴링을 재개한다. token은 Meshy의 최대 API 자산 보존 기간과 맞춘 72시간 동안 유효하며 고객이나 분석이 다르면 거부된다. 서버는 진행 중 promise를 포함한 2.5초 in-process 폴링 캐시로 같은 Meshy 작업의 동시 조회를 합친다.

### 2.6 idempotency와 유료 호출 상한

OpenAI 텍스처와 Meshy 리텍스처는 각각 고객·분석·provider를 하나의 논리 작업으로 본다. 서버는 기존 `idempotency_keys`에 작업을 먼저 예약한다. 같은 idempotency key와 style hash의 완료 요청은 OpenAI texture 또는 Meshy task token을 재생하고, 최초 요청이 아직 진행 중이면 `409 TEXTURE_REQUEST_IN_PROGRESS`로 두 번째 provider 호출을 막는다. 같은 분석/provider에 다른 key나 input을 보내거나 이전 호출이 실패한 경우에도 operator reset 전에는 `409`로 막는다. 따라서 시연 경로에서는 **분석 하나당 provider별 유료 생성 호출을 최대 한 번** 시작한다. 브라우저도 분석+provider별 key를 `sessionStorage`에 보존하고 in-flight ref로 중복 클릭을 막지만, 최종 과금 gate는 서버의 provider+analysis 저장 키와 요청 hash다.

이 캐시는 네트워크 재시도와 중복 클릭에 따른 이중 과금을 줄이기 위한 데모 보호 장치다. OpenAI 결과 data URL 또는 Meshy task 참조가 응답 JSON에 저장될 수 있다. 동일 DB의 원자적 quota slot으로 고객·provider별 UTC 하루 최대 3개 분석, 배포 전체 provider별 하루 최대 5개 분석만 유료 호출을 시작할 수 있다. 기본 응답 row 저장이 실패하면 재시도 후 전역 quota row를 보조 복구 캐시로 사용한다. 테이블의 `expires_at` 기본값은 24시간이지만 현재 texture service는 만료 row를 자동 회수하거나 삭제하지 않는다. 완료 cache는 정리 전까지 남을 수 있고, 진행 중·실패 row는 운영자가 reset해야 한다. 장기 결과 보존, 재생성 버전, 월 quota와 금액 기반 provider budget은 구현하지 않았다. 운영에서는 durable job과 asset 레코드, purge worker, 분산 rate limit, 비용 ledger를 별도로 둬야 한다.

## 3. `@google/model-viewer`를 사용한 이유와 경계

현재 요구는 완성된 GLB를 회전·확대하고 한 material의 base-color texture를 바꾸는 것이다. `@google/model-viewer`는 GLB 로딩, 카메라, 모바일 입력, 로딩 상태와 Materials API를 웹 컴포넌트 수준에서 제공한다. 공식 scene graph 예제도 texture 생성·교체를 지원한다. 자세한 동작은 [`<model-viewer>` Materials & Scene 예제](https://modelviewer.dev/examples/scenegraph/)를 기준으로 한다.

따라서 이 MVP에서는 직접 렌더 루프, 카메라, 조명, glTF loader와 dispose 수명주기를 구현해야 하는 Three.js가 필요하지 않다. `model-viewer` 내부 구현은 Three.js를 사용하지만 애플리케이션은 그 저수준 API에 결합하지 않는다.

현재 `reborn-passport-wallet.glb`는 UV가 있으나 mesh/primitive/material이 하나인 `Material_0` 구조다. 로컬 texture 교체는 지갑 전체 base color에 적용되므로 본체, 테두리와 하드웨어를 정확히 분리하지 못한다. Meshy도 기준 bag 사진과 여권지갑 geometry 차이 때문에 패널별 모티프 위치를 보장하지 않는다. 운영 목업은 다음 중 하나를 먼저 제작해야 한다.

- DCC 도구에서 외피, 안감, 금속, 봉제, 엣지를 별도 material과 UV island로 분리한 canonical GLB
- 제품 패턴과 재단선을 표현하는 panel mask 및 실제 치수 기반 UV 템플릿
- 서버/worker에서 승인된 texture와 PBR map을 GLB에 bake한 뒤 최종 GLB를 `model-viewer`로 표시하는 asset pipeline

사용자가 브라우저에서 패널을 직접 선택하고 UV를 이동·회전하거나 실시간 mask 합성·shader 편집을 해야 할 때만 Three.js 편집기를 별도 도입한다. 최종 GLB를 보는 단계는 계속 `model-viewer`로 유지할 수 있다.

## 4. 환경 변수

비밀값은 배포 환경의 server-only secret에만 저장한다. `OPENAI_API_KEY`, `MESHY_API_KEY`, `TEXTURE_TASK_SIGNING_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`에 `NEXT_PUBLIC_` 접두사를 붙이면 안 된다.

```dotenv
# 공통 인증/DB
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://demo.example.com

# 분석: 기본은 외부 호출 없는 재현 가능 모드
AI_MODE=DEMO_FIXTURE
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.6
ENABLE_EXTERNAL_AI=false
EXTERNAL_AI_PRIVACY_NOTICE_VERSION=
NEXT_PUBLIC_EXTERNAL_AI_PRIVACY_NOTICE_VERSION=

# 선택형 텍스처 provider
ENABLE_TEXTURE_AI=false
OPENAI_IMAGE_MODEL=gpt-image-2
MESHY_API_KEY=
TEXTURE_TASK_SIGNING_SECRET=
MESHY_MOCKUP_MODEL_URL=https://demo.example.com/assets/models/reborn-passport-wallet.glb
MESHY_RETEXTURE_MODEL=meshy-7
```

설정 규칙은 다음과 같다.

- 실제 분석을 켜려면 `AI_MODE=LIVE`, `ENABLE_EXTERNAL_AI=true`, OpenAI 키·vision model, 비어 있지 않은 privacy notice version이 모두 필요하다.
- `NEXT_PUBLIC_EXTERNAL_AI_PRIVACY_NOTICE_VERSION`은 서버의 `EXTERNAL_AI_PRIVACY_NOTICE_VERSION`과 정확히 같아야 고객이 본 버전을 요청에 보낼 수 있다.
- 외부 texture 버튼을 켜려면 `ENABLE_TEXTURE_AI=true`와 해당 provider 키·model 설정이 필요하다. provider별 capability만 노출하며 키는 반환하지 않는다.
- Meshy task token에는 `TEXTURE_TASK_SIGNING_SECRET`으로 32자 이상의 고엔트로피 server-only secret을 별도로 설정한다. Meshy API key를 signing key로 재사용하지 않는다.
- Meshy model URL은 Meshy 서버가 접근할 수 있는 공개 HTTPS GLB여야 한다. `MESHY_MOCKUP_MODEL_URL`을 생략하면 공개 HTTPS인 `NEXT_PUBLIC_APP_URL` 아래의 기본 GLB URL을 조합한다. localhost는 사용할 수 없다.
- `MESHY_RETEXTURE_MODEL`은 `meshy-5`, `meshy-6`, `meshy-7`, `latest`만 허용하고 나머지는 `meshy-7`로 폴백한다.

## 5. 동의, 보안, 보존과 비용

### 동의와 보안

- 분석 동의와 texture 동의는 별개다. 분석 `LIVE`는 정면·후면·상단·하단·좌측면·우측면 6장 원본을 OpenAI로 보내며, texture 단계는 선택한 provider에 추출·보정 소재 이미지를 보낸다.
- texture 개인정보 안내 버전은 `MCM_TEXTURE_AI_2026_08_21_R2`로 고정되어 있다. 체크박스를 선택하고 provider 버튼을 누르기 전에는 유료 외부 호출이 발생하지 않는다.
- 동의 시각, 고객, 분석, 안내 버전과 요청 hash를 기존 외부 AI 동의 테이블에 기록한다. API는 인증된 분석 소유권을 먼저 확인한다.
- 입력은 base64 JPEG/PNG 2MB 이하로 제한하고 content magic byte를 검사한다. Meshy 기준 model URL은 배포 환경만 결정하며, provider 결과는 HTTPS와 허용된 Meshy asset host를 검증한다.
- OpenAI와 Meshy API 키는 서버에서만 Bearer 인증에 사용한다. Meshy 공식 인증 가이드는 [API key를 안전한 장소에 보관하고 노출 시 폐기](https://docs.meshy.ai/en/api/authentication)하도록 안내한다.

### 보존

- 로컬 크롭·미러 texture와 브라우저 object URL은 현재 세션용이다.
- 데모 idempotency cache는 완료 응답 또는 진행 중·실패 상태를 보존한다. schema의 `expires_at`은 기본 24시간이지만 texture row의 자동 회수·물리 삭제는 구현하지 않았으므로 보존 기간 SLA로 해석하면 안 된다.
- OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않지만 명시적 opt-in은 예외이며, 기본 abuse monitoring log에는 고객 콘텐츠가 포함되어 최대 30일 보존될 수 있다. 계정별 Modified Abuse Monitoring/Zero Data Retention 적용 가능성과 이미지 endpoint 조건은 배포 전에 [OpenAI Data Controls 공식 문서](https://developers.openai.com/api/docs/guides/your-data)에서 확인한다.
- Meshy는 API 생성 asset을 최대 3일만 보존한다고 명시한다. 현재 MVP는 성공 GLB를 자체 Storage에 복사하지 않으므로 URL 만료 후 다시 표시할 수 없다. 운영 전에는 결과를 즉시 소유 object storage로 복사하고 checksum, MIME, 소유자, provenance와 삭제 기한을 저장해야 한다. 근거는 [Meshy Asset Retention](https://docs.meshy.ai/en/api/asset-retention)이다.

### 비용

- 로컬 texture 추출과 `model-viewer` 적용에는 AI provider 과금이 없다.
- OpenAI 이미지 편집은 현재 OpenAI API 사용량에 따라 과금된다. 모델·품질별 금액은 바뀔 수 있으므로 배포 시 [GPT Image 2 모델·가격 안내](https://developers.openai.com/api/docs/models/gpt-image-2)와 계정 spend limit을 확인한다.
- Meshy Retexture 2K/4K는 2026-08-21 공식 표 기준 호출당 10 credits이며 API는 pay-before-use다. Pro 계정 보유만으로 현재 API credit 잔액이 충분하다고 가정하지 않는다. 시연 전에 [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)과 계정 잔액을 확인한다.
- 동일 분석/provider의 reserve·cache·replay, 고객별 하루 3회와 배포 전체 하루 5회 상한은 중복·단기 과금을 제한하지만 월 quota, 금액 기반 예산이나 비용 알림을 대신하지 않는다.

## 6. 안전한 시연 절차

1. 실제 고객 정보가 없는 준비된 가상 사진과 CUSTOMER 데모 계정을 사용한다.
2. 먼저 `AI_MODE=DEMO_FIXTURE`, `ENABLE_EXTERNAL_AI=false`, `ENABLE_TEXTURE_AI=false`로 전체 흐름을 실행한다. 분석 mode/provider 표시, 추천 순위·사유, 로컬 크롭·미러 타일과 원본/맞춤 3D 전환을 확인한다.
3. OpenAI `LIVE` 분석을 시연할 때만 server/public privacy version을 같은 값으로 배포하고, 화면 동의 문구를 읽은 뒤 체크한다. 품질 미달은 재촬영으로 복구하고 Fixture 성공으로 위장하지 않는다.
4. 외부 texture는 현재 분석의 실제 촬영 blob이 브라우저에 남아 있을 때만 활성화된다. 직접 목업 URL로 진입할 때 쓰는 가상 fallback 이미지는 외부 provider로 보내지 않는다. OpenAI spend limit, Meshy API credit 잔액, 공개 HTTPS GLB 접근성을 확인하며 provider를 모두 켤 필요는 없다.
5. texture 동의 체크 뒤 OpenAI 버튼을 한 번 눌러 보정 texture와 로컬 texture를 비교한다. 결과가 부정확해도 실제 제품 보증처럼 설명하지 않는다.
6. Meshy 버튼을 한 번 눌러 비동기 진행률을 확인한다. 탭 새로고침 후 같은 분석으로 돌아와 session token으로 상태 확인이 재개되는지 확인한다.
7. Meshy 결과 GLB 로드 또는 WebGL이 실패하면 기존 로컬 GLB와 결정론적 texture 폴백으로 시연을 계속한다.
8. 발표가 끝나면 테스트 키를 회전할 필요가 있는지 확인하고, 동의·idempotency row와 provider 대시보드 사용량을 점검한다.

## 7. 다른 AI·API·MCP로 확장하는 구조

서버의 provider 경계는 다음 두 interface로 분리되어 있다.

```ts
interface TextureImageProvider {
  createTexture(styleImage: TextureStyleImage): Promise<TextureResponse>;
}

interface RetextureProvider {
  createTask(styleImage: TextureStyleImage): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<NormalizedTaskResponse>;
}
```

새 이미지 AI는 `TextureImageProvider`, 새 3D 서비스는 `RetextureProvider`를 구현하고 내부 응답을 공통 texture/task 형태로 정규화한다. capability 조회, 동의, 인증, 입력 검증, 소유권, idempotency, 비용 gate는 adapter 밖의 공통 service가 계속 담당해야 한다. provider 고유 API 키나 원시 오류·asset URL을 브라우저에 그대로 전달하지 않는다.

MCP는 브라우저가 직접 호출하는 provider로 취급하지 않는다. 운영 가능한 MCP 연동은 신뢰된 서버 worker 또는 MCP gateway가 tool 호출을 수행하고, 다음의 안정된 내부 job 계약으로 변환하도록 한다.

```text
Next.js API -> durable job queue -> provider/MCP adapter
            -> owned asset broker -> normalized result record
            -> signed asset URL -> model-viewer
```

운영 전 최소 보강은 다음과 같다.

- `texture_jobs`: 상태, provider, 모델/프롬프트 버전, analysis/product/asset ID, attempt, 비용, 오류, 생성·완료·만료 시각을 보존한다.
- `derived_assets`: 원본 hash, 출력 checksum, MIME, 크기, color space, PBR channel, GLB/UV 버전, provider provenance와 고객 소유권을 저장한다.
- queue/worker: webhook 또는 backoff polling, timeout, dead-letter, 취소, 재실행 정책을 제공한다.
- asset broker: 외부 signed URL을 즉시 소유 Storage로 복사하고 malware/MIME 검증, CORS, signed download와 lifecycle purge를 담당한다.
- quota/cost ledger: 고객·분석·provider별 한도, 전역 일 예산, 동시성, credit 부족과 circuit breaker를 관리한다.
- 품질 gate: segmentation/UV/mask 적합도, 왜곡·반복 경계·색차, GLB load와 texture 누락을 자동 검사하고 사람 승인을 기록한다.
- privacy: 목적별 동의, 철회·삭제 요청, provider별 retention/data residency와 감사 로그를 운영 정책으로 확정한다.

이 구조에서는 OpenAI, Meshy, 다른 HTTP AI나 MCP tool을 교체해도 분석·추천·UI 계약을 유지할 수 있다. 다만 현재 MVP의 in-process poll cache, 자동 삭제 없는 idempotency 응답, 72시간 task token, sessionStorage 복구와 외부 임시 URL은 durable production architecture를 대체하지 않는다.

## 8. 공식 참고 자료

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2)
- [OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data)
- [Meshy Retexture API](https://docs.meshy.ai/en/api/retexture)
- [Meshy Authentication](https://docs.meshy.ai/en/api/authentication)
- [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)
- [Meshy Asset Retention](https://docs.meshy.ai/en/api/asset-retention)
- [`<model-viewer>` Materials & Scene](https://modelviewer.dev/examples/scenegraph/)
