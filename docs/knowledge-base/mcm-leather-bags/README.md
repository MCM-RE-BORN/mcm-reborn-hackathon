# MCM 가죽 가방 공개 지식 베이스

버전: `MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1`

조사 기준일: `2026-08-21` (Asia/Seoul)

언어: 한국어 요약, 원문 용어 병기

범위: 공개 웹에서 검증 가능한 MCM 가방의 패턴, 패턴 디자인, 소재, 구조 설계, 가죽 종류, 조달 및 공정

## 목적

이 디렉터리는 이미지 분석·재사용 설계용 AI가 다음을 혼동하지 않도록 원자형 사실과 출처를 보존한다.

- 브랜드 또는 제품이 직접 공개한 사실과 업계 일반 지식
- 사실이 유효한 시기와 웹에서 확인한 시기
- 가죽의 동물 종, 그레인 구조, 촉감·표면 마감, 무두질법
- 본체, 트림, 안감, 보강재, 하드웨어
- 소재 원산지, 제혁 위치, 최종 조립국, 제품의 `Made in`
- 직접 근거, 파생 해석, 미확인 값
- 서로 충돌하는 공식 주장

이 자료는 정품 판정, 법적 감정, 화학 성분 분석 또는 개별 제품의 파괴 검사를 대체하지 않는다.

## 파일 구성

- `schema/knowledge-record.schema.json`: 출처·사실·제품·이미지 스냅샷의 공통 계약
- `data/sources.json`: 출처 레지스트리와 공개·확인 시기
- `data/claims.jsonl`: 출처에 연결된 원자형 사실 및 명시적 미확인 값
- `data/products.jsonl`: 대표 공식 SKU의 부품별 소재·구조 스냅샷
- `data/pattern_image_references.jsonl`: 공식 패턴 이미지와 패턴으로 오인하지 않도록 분리한 편집 맥락 이미지 URL
- `data/material_image_references.jsonl`: 공식 소재·표면 상품 이미지 URL과 관찰·검증 메타데이터
- `IMAGE_INDEX_KO.md`: 패턴·소재별 대표 이미지 갤러리와 전체 레지스트리 안내
- `RESEARCH_REPORT_KO.md`: 조사 결과, 타임라인, 한계와 AI 적용 규칙
- `CRAWL_LOG.md`: 수집 범위와 접근 제약
- 저장소 루트의 `scripts/validate_mcm_leather_knowledge.py`: ID, 날짜, URL, 참조 무결성 검증

## 시간 모델

한 개의 날짜로 출시일, 보고기간, 페이지 갱신일을 섞지 않는다.

- `valid_time`: 주장 자체가 가리키는 연도·시즌·기간
- `published_at`: 출처가 실제 공개된 날짜. 확인할 수 없으면 `null`
- `observed_at`: 조사자가 공개 페이지를 마지막으로 확인한 날짜
- 출처의 `date_precision`: `day`, `month`, `year`, `unknown`
- claim의 `valid_time.precision`: `day`, `month`, `year`, `season`, `range`, `unknown`
- claim의 `valid_time.status`: 현재·역사적 스냅샷, 보고기간, 목표, 법적 사건, 표준 버전, 최초 확인일 등을 구분
- 이미지의 `date_basis`: 편집 페이지 공개일, CDN 헤더 시각, 미확인을 구분
- 이미지의 `checked_at`: 저장한 URL이 실제 이미지로 응답한 검증일

월·연도까지만 알려진 `published_at`은 각각 그 달 또는 해의 첫날을 정규화 앵커로 저장하고 `date_precision`으로 정확도를 제한한다. 시즌 claim은 시즌명이 속한 달력 연도의 시작·끝을 검색용 외피로 기록하며, 이 범위를 실제 판매기간으로 해석하지 않는다. 제품 페이지처럼 발행일이 없는 살아 있는 문서는 `published_at: null`을 유지하고 `observed_at`만 기록한다. 상표 출원일이나 최초 검색일은 제품 출시일로 승격하지 않는다.

제품은 `product_snapshot`이며 `(style_number, market, observed_at)` 조합으로 구분한다. 부품 속성의 `attribute_state`는 `reported`, `unknown`, `not_applicable`을 분리하므로 `null` 하나를 모두 같은 의미로 읽지 않는다.

## 근거 모델

`fact_scope`와 `evidence_mode`를 반드시 함께 해석한다.

| 값 | 의미 |
| --- | --- |
| `mcm_brand` | MCM 전체 또는 브랜드가 직접 주장한 내용 |
| `mcm_product` | 특정 SKU·컬렉션에만 적용되는 내용 |
| `supplier_historical` | 특정 시기의 MCM 관련 공급사·공장 보도 |
| `industry_general` | 제혁·가방 제작 일반 공정. MCM 적용은 미확인 |
| `legal_record` | 상표·특허·법원 기록의 사실 또는 당사자 주장 |
| `direct` | 출처가 해당 내용을 직접 명시 |
| `derived` | 둘 이상의 직접 근거를 제한적으로 결합 |
| `inferred` | 업계 정의나 정황을 적용한 해석 |
| `unknown` | 공개 근거로 확인하지 못한 값 |

신뢰도 등급은 출처의 독립성과 직접성을 함께 표시한다.

- `A`: 공공기관·표준·인증기관의 1차 자료
- `S`: MCM 공식 보고서·공식 제품 또는 컬렉션 페이지
- `B`: 성주그룹 공식 연혁, 당시 업계·주요 매체
- `C`: 공인·대형 판매점, 보존 카탈로그
- `D`: 개인 판매·포럼. 연대 확정에는 사용하지 않음

## 금지하는 자동 정규화

다음 치환은 공개 근거보다 강한 주장을 만들어 내므로 허용하지 않는다.

- `Visetos = 가죽`
- `canvas = 면`
- `현재 모든 Visetos = PU`
- `Nappa = 송아지가죽`
- `natural leather = 베지터블 태닝 / 풀그레인 / 크롬프리`
- `embossed leather = 특정 동물 종 또는 full-grain`
- `leather = polymer coating 없음/해당 없음` — 공개 문구가 없으면 `coating_polymer: unknown`
- `microfiber lining with suede finish = 동물성 스웨이드`
- `LWG = 제품 인증`
- `Made in Italy = 이탈리아산 원피 또는 이탈리아 제혁`
- `상표 출원일 = 제품 출시일`
- `공식 목표값 = 달성값`

## 대표적인 충돌·보류 규칙

- MCM 다이아몬드 모티프의 기원은 현행 글로벌 Heritage 페이지의 `바이에른 국기`와 현재 접근 가능한 지역 Corporate 페이지의 `고대 프랑스 카드`가 충돌한다. 지역 페이지의 콘텐츠 작성 시기는 확인되지 않았으므로 두 값을 모두 유지한다.
- MCM Heritage가 Haus가 `Leather Working Group certification`을 받은 것처럼 표현한 문구와, 브랜드·완제품 자체를 LWG-certified라고 부르지 못하게 하는 LWG 지침을 `CONFLICT-002`로 함께 보존한다.
- 2024 보고서의 정확 보고값 `100%`와 현재 지속가능성 페이지의 하한 `최소 78%`는 논리적 충돌이 아니다. 보고기간과 값의 성격이 달라 각각 보존한다.
- 2024 소재 로드맵은 코팅 캔버스를 과거 표준 PVC, 2024년 lower-impact PU로 설명하지만 개별 SKU의 코팅 수지는 보통 공개하지 않는다.
- 일반 공정은 가능한 공정 지식일 뿐, 개별 MCM SKU의 확정 라우팅이나 BOM이 아니다.

## 검증

저장소 루트에서 표준 라이브러리만 사용하는 검증기를 실행한다.

```text
python -X utf8 scripts/validate_mcm_leather_knowledge.py
```

검증기는 저장된 JSON Schema 계약을 모든 레코드에 실제 적용하고, ID·출처 URL·이미지 자산 중복, ISO 날짜, HTTPS 출처, claim·product·image의 출처 참조, 제품의 단일 본체와 부품 역할, 이미지 파일별 유형·공식 채널 URL·원본 페이지, 날짜 근거, 권리 상태, 충돌 그룹과 목표·미확인 값의 AI 사용 제약을 추가로 확인한다.

## 저작권·재현성

원문 페이지 전체, 제품 이미지, 로고 파일은 저장하지 않는다. MCM 공식 채널에 게시된 링크, 자산 ID, 출처 페이지, 확인 시점만 `unknown_reference_only`로 보존한다. 이 값은 내부 분류이며 권리자 확인이나 재사용·재배포·모델 학습 허가가 아니다. 직접 인용 대신 연구자가 작성한 한국어 의역을 사용한다.

공개 웹의 동적 재고·페이지 변경과 지역별 카탈로그 차이 때문에 이 버전은 절대적 전수조사가 아니라 `2026-08-21`에 확인한 공개 근거의 스냅샷이다. 원문과 이미지 파일을 보관하지 않으므로 미래 시점의 완전한 재현을 보장하지 않는다.
