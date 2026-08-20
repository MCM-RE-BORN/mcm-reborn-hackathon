# MCM 가죽 지식 베이스 런타임 위키

## 목적

`MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1`은 모델의 영구 학습 데이터나 전체 고정 프롬프트가 아니다. 사람이 검토할 수 있는 원자형 위키를 앱 서버가 요청별로 검색하고, LIVE 이미지 분석에는 관련성이 높은 일부 레코드만 전달한다.

```text
작성 원본 JSON/JSONL
  → 해시가 포함된 서버 전용 생성 스냅샷
  → 사진 기반 검색어 도구 호출 1회
  → 결정론적 top-K 검색
  → 출처·시기·적용 제한이 포함된 작은 tool result
  → 기존 BagVisionSchema Structured Output
```

## 런타임 흐름

1. 첫 OpenAI 호출은 여섯 사진을 보고 소재·표면·패턴·구조의 일반 검색어만 만든다.
2. `tool_choice`는 `search_mcm_leather_wiki` 하나로 고정하고 병렬 도구 호출을 끈다.
3. 서버는 로컬 생성 스냅샷을 검색한다. 외부 검색 서비스나 벡터 DB를 호출하지 않는다.
4. 두 번째 OpenAI 호출은 같은 여섯 사진, 검색 결과, 기존 재사용 가이드로 현재 `BagVisionSchema`만 반환한다.
5. 최종 제공자 요청 ID와 별도로 조회 요청 ID, query hash, 레코드·출처 ID, 정확한 tool context hash와 적용 상태를 `provider_result`에 기록한다. 조회 뒤 최종 호출이 실패해 Fixture로 폴백해도 `LOOKUP_COMPLETED_FINAL_FAILED` trace는 보존한다.

두 번의 모델 호출이 필요하므로 LIVE 비용과 지연은 기존 단일 호출보다 증가한다. 반면 전체 코퍼스를 매번 보내지 않고 검색 1회와 8,000자 컨텍스트 상한을 강제한다. Fixture와 외부 제공자 장애 폴백 정책은 유지한다.

## 검색 및 적용 규칙

- Unicode NFKC와 영문 소문자 정규화, 제한된 한·영 동의어, 안정된 ID tie-break를 사용한다.
- 서버는 검색 전에 8~24자리 영문·숫자 혼합 토큰을 시리얼·style number 후보로 제거하고 자유 검색어 원문을 최종 호출이나 DB에 재전달하지 않는다.
- 최대 6개 결과만 반환하며 검색 실패 때 전체 코퍼스로 폴백하지 않는다.
- `ai_use: exclude`는 반환하지 않는다. `negative_constraint`와 `evidence_mode: unknown`은 관련 검색에서 우선한다.
- 충돌 그룹 한쪽이 선택되면 상대 claim도 같은 `conflict_set`에 포함한다.
- claim에는 `fact_scope`, `evidence_mode`, `ai_use`, `confidence`, `valid_time`, `observed_at`과 출처 locator를 유지한다.
- 제품 스냅샷은 `reported`, `unknown`, `not_applicable` 상태를 값과 함께 보존한다.
- 특정 SKU는 예시일 뿐이며 사진만으로 동일 제품·생산국·숨은 소재를 확정하지 않는다.
- `industry_general`은 MCM에 적용된 공정으로 승격하지 않는다.
- 정품 여부, 시리얼 일치, 제조연도는 위키 조회나 사진만으로 판단하지 않는다.

## 생성과 검증

작성 원본을 변경한 뒤 다음을 실행한다.

```text
python -X utf8 scripts/build_mcm_leather_wiki.py
python -X utf8 scripts/build_mcm_leather_wiki.py --check
python -X utf8 scripts/validate_mcm_leather_knowledge.py
```

생성물에는 세 원본 파일의 SHA-256과 결합 코퍼스 SHA-256이 들어간다. 검색기·프롬프트·기존 재사용 가이드 버전까지 합친 값은 LIVE 분석의 멱등 request hash에 포함되므로 지식 또는 검색 동작이 달라진 결과를 과거 요청과 조용히 재사용하지 않는다.

## 이미지 경계

패턴 92건, 소재 167건, 편집 맥락 4건의 링크·검증 메타데이터는 사람용 위키에 남는다. 권리 상태가 참조 전용이고 원본 파일을 보관하지 않으므로 LIVE 모델에 이미지 URL이나 바이너리를 보내지 않는다. 공식 사진은 제품 메타데이터의 시각 참고 링크이며, 고객 사진의 자동 매칭 ground truth나 모델 학습 허가가 아니다.
