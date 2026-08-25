# MCM 가죽 지식 베이스 런타임 위키

## 목적

`MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1`은 모델의 영구 학습 데이터나 전체 고정 프롬프트가 아니다. 사람용 작성 원본은 103개 출처·97개 claim·36개 제품 스냅샷을 보존하고, 앱 서버는 그중 검토된 시각 claim 18개와 필요한 출처만 별도 분석용 스냅샷으로 생성한다. LIVE 이미지 분석에는 always-on 금지 경계 7개와 요청에 맞는 dynamic claim 일부만 전달한다.

```text
작성 원본 JSON/JSONL
  → 검토된 claim 18개의 서버 전용 생성 스냅샷
  → 7개 금지 경계는 항상 developer prompt에 포함
  → low-detail 사진 기반 검색어 도구 호출 1회
  → 11개 dynamic claim의 결정론적 top-K 검색
  → 최대 5개·4,000자의 작은 tool result
  → auto-detail BagVisionSchema v3 Structured Output
```

## 런타임 흐름

1. 첫 OpenAI 호출은 원래 6면 인덱스를 유지한 `0 FRONT`, `1 REAR`, `4 LEFT`, `5 RIGHT`의 네 `detail: low` 외관 사진만 보고 소재·표면·패턴·구조의 일반 검색어를 만든다. TOP과 BOTTOM은 이 단계에서 제외한다.
2. `tool_choice`는 `search_mcm_leather_wiki` 하나로 고정하고 병렬 도구 호출을 끈다.
3. 서버는 로컬 생성 스냅샷의 dynamic 11개 claim만 검색한다. 외부 검색 서비스나 벡터 DB를 호출하지 않고 제품 예시는 항상 비활성화한다.
4. 두 번째 OpenAI 호출은 상단·하단을 포함한 여섯 `detail: auto` 사진, 검색 결과, PDF 재사용 가이드와 always-on 금지 경계로 현재 `BagVisionSchema` v3 분석과 외관 profile을 함께 반환한다.
5. 최종 제공자 요청 ID와 별도로 조회 요청 ID, query hash, 순서가 보존된 claim·출처 ID, 정확한 tool context hash와 적용 상태를 `provider_result`에 기록한다. 조회 뒤 최종 호출이 실패해 Fixture로 폴백해도 `LOOKUP_COMPLETED_FINAL_FAILED` trace는 보존한다.

두 번의 모델 호출이 필요하므로 LIVE 비용과 지연은 기존 단일 호출보다 증가한다. 첫 호출은 외관 4면만 `detail: low`로 보내고 작은 출력 한도를 쓰며, 전체 코퍼스 대신 최대 5개·4,000자만 최종 호출에 전달해 증가폭을 제한한다. 최종 분석은 품질·상하단 손상 근거를 잃지 않도록 6면을 유지한다. OpenAI client 자동 재시도는 끄고 전체 145초 deadline 안에서 lookup은 최대 35초·1회, 최종 분석은 시도당 최대 60초·전체 최대 2회로 제한한다. lookup 무결과나 로컬 schema·검색·provider 5xx 실패는 전체 코퍼스로 폴백하지 않고 7개 always-on 경계와 사진으로 최종 분석을 계속하지만, lookup의 rate limit·quota·timeout·인증성 4xx 뒤에는 최종 6면 호출을 추가하지 않고 canonical Fixture로 복구한다. Fixture와 외부 제공자 장애 폴백 정책은 유지한다.

## 검색 및 적용 규칙

- Unicode NFKC와 영문 소문자 정규화, 제한된 한·영 동의어, 안정된 ID tie-break를 사용한다.
- 서버는 검색 전에 8~24자리 영문·숫자 혼합 토큰을 시리얼·style number 후보로 제거하고 자유 검색어 원문을 최종 호출이나 DB에 재전달하지 않는다.
- 정확한 lexical token·phrase hit가 없는 claim은 topic이 맞아도 반환하지 않는다. topic은 일치 후보 안의 ranking 보조값일 뿐이다.
- 최대 5개 결과·4,000자만 반환하며 검색 실패 때 전체 코퍼스로 폴백하지 않는다.
- runtime 후보는 승인된 `grounding` claim 11개뿐이다. `context_only`, `exclude`, 제품 스냅샷, 비선정 history·legal·care·sourcing claim은 포함하지 않는다.
- 결과 claim에는 `fact_scope`, `evidence_mode`, `confidence`, `valid_time`, `observed_at`과 축약 출처 locator를 유지한다.
- 제품 예시는 tool schema와 sanitizer에서 `false`로 고정한다. 사진만으로 동일 제품·생산국·숨은 소재를 확정하지 않는다.
- exact style 정보를 포함한 always-on 금지 claim은 작성 원문 hash를 남기되 모델에는 일반화한 prompt-safe 경계만 전달한다.
- `industry_general`은 MCM에 적용된 공정으로 승격하지 않는다.
- 정품 여부, 시리얼 일치, 제조연도는 위키 조회나 사진만으로 판단하지 않는다.

## 생성과 검증

작성 원본을 변경한 뒤 다음을 실행한다.

```text
python -X utf8 scripts/build_mcm_leather_wiki.py
python -X utf8 scripts/build_mcm_leather_wiki.py --check
python -X utf8 scripts/validate_mcm_leather_knowledge.py
```

생성물에는 작성 원본의 SHA-256, full corpus SHA-256, 분석용 retrieval corpus SHA-256, claim 역할과 순서가 들어간다. 검색기·프롬프트·기존 재사용 가이드 버전까지 합친 값은 LIVE 분석의 멱등 request hash에 포함되므로 지식 또는 검색 동작이 달라진 결과를 과거 요청과 조용히 재사용하지 않는다. 현재 외관 profile을 목업 단계에서 재사용할 때도 같은 provenance와 조회 ID allowlist를 검증한다.

## 이미지 경계

패턴 92건, 소재 167건, 편집 맥락 4건의 링크·검증 메타데이터는 사람용 위키에 남는다. 권리 상태가 참조 전용이고 원본 파일을 보관하지 않으므로 LIVE 모델에 이미지 URL이나 바이너리를 보내지 않는다. 공식 사진은 제품 메타데이터의 시각 참고 링크이며, 고객 사진의 자동 매칭 ground truth나 모델 학습 허가가 아니다.
