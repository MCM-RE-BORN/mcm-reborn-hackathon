# MCM 가죽 가방 패턴·소재·설계·공정 공개조사 보고서

조사 기준일: **2026-08-21 KST**

지식 베이스 버전: `MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1`

## 1. 결론 요약

1. **Visetos는 가죽명이 아니다.** MCM이 대표 Visetos를 설명할 때의 본체는 이탈리아산 코팅 캔버스이고, 가죽은 nappa·calf 등의 trim으로 결합되는 경우가 많다. 별도로 천연가죽에 Maxi Visetos를 엠보싱한 제품도 있다. [MCM Heritage](https://us.mcmworldwide.com/en_US/heritage-edit), `SRC-001`.
2. 원형 시각 문법은 `MCM 문자 + 리본으로 묶인 월계수 + 다이아몬드`다. 월계수 잎은 좌 9개·우 8개라고 공식 설명된다.
3. 패턴 계보는 `1976 Visetos → AW19 계절색 → 2021 Vintage Jacquard·Cubic → SS24 Lauretos → AW26 Disco Visetos·Diamond Jacquard 등`으로 확인된다.
4. 다이아몬드 기원은 공식 자료끼리 충돌한다. 현행 글로벌 Heritage는 바이에른 국기, 현재 접근 가능한 지역 Corporate 페이지는 고대 프랑스 카드라고 한다. 지역 페이지의 콘텐츠 작성 시기는 확인되지 않았다.
5. 가죽 관련 단어는 하나의 등급표가 아니다. `calf/lamb/goat`는 동물 종, `full grain`은 표면 구조, `nappa`는 부드러운 가죽 유형, `embossed/quilted/crushed/croco`는 표면·가공 효과다.
6. 대표 제품은 본체·트림·안감·하드웨어가 다른 **복합 제품**이다. `microfiber with suede finish`는 동물성 suede가 아니다.
7. 현재 제품 표본에서 확인된 완제품 생산국은 주로 한국과 이탈리아다. 소재 원산지, 제혁국, 최종 조립국은 서로 다른 값이다.
8. MCM 공식 자료로 확인되는 패턴 구현법은 인쇄, 엠보싱, 자카드 직조, 퀼팅, 스터드, 도금이다.
9. 2013년 MCM 주력 협력사 보도에는 재단, 배피, 기리메, 안감, 컴퓨터 미싱, 조립·봉제, 검품·포장이 나온다. 이는 당시 해당 공급사 스냅샷이며 현행 전 제품 공정이 아니다.
10. MCM 2024 보고서의 2024년 정확 보고값 `100%`와 살아 있는 지속가능성 페이지의 하한 `최소 78%`는 모순이 아니다. 보고기간과 값의 성격을 나눠 저장했다.
11. LWG는 브랜드나 완제품 자체를 인증하지 않고 공급망 시설을 감사·인증한다. “LWG 인증 가방/브랜드”라는 치환은 부정확하다. [LWG Claims Guidance](https://www.leatherworkinggroup.com/what-we-do/claims-guidance/), `SRC-017`.
12. 공개 자료에는 개별 SKU의 인쇄 잉크, 코팅 두께, 엠보싱 압력·온도, 실 규격·SPI, 접착제, 엣지코트 배합, 도금 두께, 패널·피할 두께, QC 허용치가 없다. 일반 공정을 MCM 고유 공정처럼 채우지 않았다.
13. `Resetos regenerated leather`는 공식 제품명·본체 표기지만 정확한 재생 함량, 결합재, 동물종, tannage와 coating 조성은 공개되지 않았다. 일반 `Responsible materials` 배지만으로 비건·베지터블 태닝·생분해성을 확정하지 않는다. [MCM Resetos Toni](https://jp.mcmworldwide.com/en_JP/women/bags/totes-shoppers/toni-top-zip-shopper-in-resetos-leather/MWPFAMT09Q5001.html), `SRC-093`.
14. 공식 제품 표본을 넓히면 patent, crushed·distressed, suede, perforation, flocking, fishnet cut-out, studding, quilting이 각각 다른 소재·표면·구조 축으로 나타난다. 사진의 질감만으로 이 축을 tannage나 동물 종으로 치환하지 않았다.

## 2. 조사 범위와 판정법

### 범위

- MCM 글로벌·지역 공식 역사, 컬렉션, 제품, 지속가능성, Digital Product Passport 페이지
- MCM 2022·2024 지속가능성 보고서
- Sungjoo Group 공식 연혁
- CIPO·USPTO 법적 기록
- LWG 정의·인증·claims framework
- OECD·UNIDO의 제혁 및 leather-goods 일반 공정
- 최초 확인 시점을 보완하는 동시대 패션·산업 보도

제품 페이지는 재고와 지역에 따라 교체되므로 `style_number`와 `observed_at`을 함께 기록했다. 날짜가 없는 페이지의 발행일은 `null`로 유지했다.

### 사실의 네 가지 상태

| 상태 | 의미 | 사용 예 |
| --- | --- | --- |
| `direct` | 출처가 직접 명시 | SKU의 body 소재, Made in, 보고서 수치 |
| `derived` | 복수 직접 근거를 제한적으로 결합 | 여행 계보의 반복 구조, 복합 소재 경향 |
| `inferred` | 업계 정의를 적용한 해석 | 배피를 skiving 계열로 읽는 것 |
| `unknown` | 공개 근거로 확인할 수 없음 | 접착제, 엠보싱 압력, 개별 Visetos 수지 |

`valid_time`은 주장 대상의 시점, `published_at`은 출처 공개일, `observed_at`은 조사 확인일이다. 이 세 값을 하나로 합치지 않았다.

## 3. 패턴과 패턴 디자인 계보

| 유효 시기 | 패턴·이벤트 | 디자인·소재 구현 | 근거 |
| --- | --- | --- | --- |
| 1976 등장 / 2026-08-21 대표형 설명 | Visetos 원형 | 손그림 MCM 문자·월계수·리본·다이아몬드의 반복. 현행 대표 Cognac 설명은 검정 모티프를 코팅 캔버스에 구현 | [MCM Heritage](https://us.mcmworldwide.com/en_US/heritage-edit), `SRC-001`; [MCM Visetos](https://au.mcmworldwide.com/en_AU/mcm-edit/mcm-visetos-aw-19), `SRC-002` |
| AW19 | Seasonal Visetos | Cognac 원형에 Deep Blue, Winter Moss, Gradation 같은 색상·그라데이션 변형 | `SRC-002` |
| 2021-06 최초 확인 | Vintage Monogram Jacquard | Visetos를 빈티지하고 직조된 표면으로 재구성 | [WWD/Yahoo](https://www.yahoo.com/lifestyle/mcm-introduces-logo-designs-first-040144766.html), `SRC-030` |
| 2021 도입 / 2022-02 공식 페이지 | Cubic Monogram | Bavarian diamond를 3D 건축 구조처럼 반복. Italian jacquard, print, Vachetta·Spanish nappa emboss | [MCM Cubic Craft](https://ca.mcmworldwide.com/mcm-edit/mcm-cubic-monogram-craftsmanship), `SRC-006` |
| 2022-01-26 / SS22 | Mode Travia 최초 확인 | 가죽 가방 캡슐, MCM 로고 하드웨어 중심 | [Office Magazine](https://officemagazine.net/node/5017), `SRC-031` |
| 2023 | New Mode Travia | Visetos를 Laurel·Diamond 모티프로 해체한 리뉴얼. SS22 최초 소개와 별도 이벤트 | [MCM Saudi History](https://mcmworldwide.sa/pages/our-history), `SRC-007` |
| 2023-11-03 판매 / SS24 | Lauretos | 각 월계수와 리본의 옆끝을 이어 곡선형 연속 패턴 구성. 초기 Cognac·Beige, canvas·jacquard 전개 | [MCM SS24](https://us.mcmworldwide.com/en_US/discover-mcm-ss24-lauretos-collection), `SRC-004`; [MCM Japan release](https://prtimes.jp/main/html/rd/p/000000066.000030922.html), `SRC-005` |
| 현행 | Maxi Visetos / Maxi Monogram | 문자·월계수·다이아몬드를 확대. coated canvas뿐 아니라 nappa·full-grain leather emboss로 실행 | `SRC-036`, `SRC-037`, `SRC-055` |
| AW26 | 계절 패턴 확장 | Disco Visetos, grained calfskin logo studs, multicolor Diamond Jacquard | [MCM AW26](https://us.mcmworldwide.com/en_US/whats-new/autumn-winter), `SRC-008`; `SRC-046`, `SRC-047` |

### 모티프가 표면을 넘어 구조가 되는 방식

- Diamond는 단순 프린트 요소에서 front flap, 가방 외곽, 각진 이중 지퍼, handle, charm, 3D volume, quilting 규칙으로 확장된다.
- Laurel은 반복 모노그램 외에도 `Laurel Lock` 같은 잠금 하드웨어로 확장된다.
- Boston·München·Ottomar는 여행 트렁크의 코너, top handle, two-way zip, padlock, feet를 현대 가방에 반복한다.
- Liz·Aren·Dessau는 탈착 pouch, reversible body, crossbody/belt 전환 등 모듈성과 hands-free 사용을 강화한다.

이 네 항목은 제품 설명을 종합한 `derived` 결과이며 모든 SKU의 필수 규칙은 아니다.

### 다이아몬드 유래 충돌

| 주장 | 상태 | 처리 |
| --- | --- | --- |
| 바이에른 국기의 lozenge | 현행 MCM 공식 서사 | `CLM-005`, `CONFLICT-001` |
| 고대 프랑스 카드 문양 | 현재 접근 가능한 지역 MCM Corporate 서사, 콘텐츠 작성 시기 미상 | `CLM-006`, `CONFLICT-001` |

패턴의 실제 시각 구조를 설명할 때는 사용할 수 있지만, 문화적 기원은 `contested`로 답해야 한다.

## 4. 소재와 가죽 종류

### 분류 축

| 축 | 확인된 값 | 해석 주의 |
| --- | --- | --- |
| 동물 종 | calf, lamb, goat, 종 미표기 leather | nappa만으로 종을 알 수 없음 |
| 그레인 구조 | full grain, grained, 미표기 | embossed는 full grain 여부가 아님 |
| 상품 소재명·유형 | nappa/napa, Vachetta, suede, patent leather, crushed leather | natural·Vachetta·patent만으로 tannage·동물 종·코팅 수지를 확정하지 않음 |
| 표면·구조 가공 | printed, embossed, croco-embossed, perforated, cut-out, flocked, quilted, crushed/distressed, sequined, studded | croco-embossed는 악어가죽이 아니며 각 가공 축을 분리 |
| 무두질 | metal-free, chrome-free 목표, 대부분 SKU 미표기 | metal-free와 chrome-free를 자동 동의어 처리하지 않음 |
| 재생가죽 표현 | Resetos regenerated leather | 정확한 재생 함량·결합재·동물종·무두질·코팅 조성 및 비건 여부 미표기 |
| 비가죽 본체 | Visetos coated canvas, jacquard, raffia jacquard, recycled nylon, MIRUM | 가죽 trim이 있어도 body 소재와 분리 |
| 안감 | cotton twill, fabric, microfiber suede finish, lamb nappa | microfiber suede finish는 동물성 suede가 아님 |
| 하드웨어 | 24K gold plated, cobalt, matte black 등 SKU별 표기 | 도금 두께·방식은 미공개 |

LWG의 2024 정의에서 full grain은 교정용 기계 가공으로 원래 grain을 제거하지 않은 가죽이고, Napa는 부드럽고 통염되며 가볍게 마감한 full-grain 계열 용어다. [LWG Definitions v1.1](https://www.leatherworkinggroup.com/fileadmin/uploads/lwg/Knowledge/LWG_List_of_Definitions_v1.1.pdf), `SRC-019`.

### 대표 SKU 부품 스냅샷

표 안의 `Italian`, `Spanish` 같은 국명은 공식 상품 페이지의 원문 마케팅 소재명을 그대로 보존한 것이다. 원료 원산지, 제혁국, 직물 제조국 중 어느 역할인지 확인되지 않으면 구조화된 `material_origin_country`는 `null/unknown`이다. `Made in` 열만 완제품 생산국이다.

| SKU | 본체 | 트림·안감 | 구조·표면 | Made in | 출처 |
| --- | --- | --- | --- | --- | --- |
| `MWRESAK02CO001` | Visetos canvas | calf nappa, microfiber suede-finish | diamond flap, Laurel print | South Korea | `SRC-032` |
| `MWTCSBO02CO001` | Visetos coated canvas | nappa, microfiber suede-finish | archival-luggage tote, pouch, feet | South Korea | `SRC-033` |
| `MMKEATA02CO001` | Visetos canvas | nappa, fabric/nylon | 3 pouches + belt bag의 modular backpack | South Korea | `SRC-034` |
| `MWBFAEA031F001` | Disco Visetos | nappa, microfiber | Boston, two-way zip | South Korea | `SRC-035` |
| `MWTDABO14BK001` | natural nappa | microfiber | embossed Maxi Visetos | Italy | `SRC-036` |
| `MWBGSEA07BK001` | natural full-grain leather | microfiber | embossed Maxi Visetos, Boston | Italy | `SRC-037` |
| `MMVFSTT04VC001` | natural nappa | webbing strap | embossed Maxi, weekender | South Korea | `SRC-038` |
| `MMKFAVE01IG001` | Lauretos jacquard | natural leather + Visetos trim, cotton twill | laptop backpack | South Korea | `SRC-039` |
| `MWBFSEA04IN001` | Italian raffia jacquard | natural nappa, microfiber | Lauretos weave/embroidery, Boston | South Korea | `SRC-040` |
| `MWTDSLD01CO001` | full-grain Spanish nappa | microfiber | trapezoid, ringed logo handles | Italy | `SRC-041` |
| `MWREAAK02CK001` | embossed leather | calf nappa | soft diamond tote | Italy | `SRC-042` |
| `MWRFSAK06Q1001` | lamb leather | nappa | sequins, diamond handles | South Korea | `SRC-043` |
| `MWDCSDU02WT001` | Visetos coated canvas | nappa, microfiber | drawstring, independent pouch | South Korea | `SRC-044` |
| `MWSGSTA05BW001` | lambskin | belt-inspired strap | Taekwondo-uniform-inspired two tone | South Korea | `SRC-045` |
| `MWRGAOB03BK001` | 100% grained calfskin | microfiber | logo studs, tassels, belt/crossbody | Italy | `SRC-046` |
| `MWTGABO01MT001` | diamond jacquard | nappa, microfiber | multicolor Bavarian diamond weave | South Korea | `SRC-047` |
| `MWPFSAC01BK001` | 100% MIRUM | fabric | shopper redesigned for alternative material | South Korea | `SRC-048`, `SRC-049` |
| `MWSEAAK01CK001` | calf nappa | microfiber | 3D diamond, angular double zip | Italy | `SRC-052` |
| `MWZFSAK01BK001` | Italian full-grain goatskin | — | 3D diamond belt/crossbody | Italy | `SRC-053` |
| `MWSCALM03BK001` | lamb nappa | lamb nappa lining | diamond cloud quilting | Italy | `SRC-054` |
| `MWSGSTA01CC001` | full-grain leather | microfiber | embossed Maxi Visetos | Italy | `SRC-055` |
| `MWDDSDU02C8001` | natural nappa | microfiber | embossed Visetos drawstring | Italy | `SRC-056` |
| `MWREAAK01CO001` | Visetos canvas | Italian croco-embossed leather handle | diamond form | South Korea | `SRC-057` |
| `MMLFSTA02BK001` | Italian recycled nylon | nappa, fabric | sling | South Korea | `SRC-058` |
| `MWPFAMT09Q5001` | Resetos regenerated leather | leather handles·strap, fabric lining | Visetos motif, top zip, back/slip/card pockets | South Korea | `SRC-093` |
| `MWSCAXT01BK001` | Visetos monogram canvas | Vachetta leather, microfiber suede-finish | Laurel Lock satchel, zip compartment | South Korea | `SRC-068` |
| `MWRFSAC01BK001` | patent leather | nappa, microfiber suede-finish | embossed Laurel flap, dual compartment | Italy | `SRC-094` |
| `MWSCSLM03BK001` | crushed leather | microfiber suede-finish | distressed surface, geometric quilting | Italy | `SRC-095` |
| `MWTFABO01K9001` | Italian suede leather | Italian calfskin, Visetos sides, microfiber | Mega Herringbone motif, tote | Italy | `SRC-096` |
| `MWTGSMA01BK001` | grained leather | natural nappa, microfiber | structured tote; 이전 URL은 redirect provenance만 보존 | Italy | `SRC-097` |
| `MWPGSAC01L8001` | Spanish calfskin leather | — | Bavarian diamond perforation, shopper | Italy | `SRC-098` |
| `MWPFSTA03WT001` | grained / embossed leather + Visetos print | natural nappa, cotton twill pouch | abstract fishnet cut-out, shopper | South Korea | `SRC-099` |
| `MWPGALR02BK001` | full-grain leather / grained nappa 요약 | leather pouch, microfiber | embossed Visetos, New Liz shopper | Italy | `SRC-100` |
| `MWSGSAK01BK001` | 100% lambskin | microfiber suede-finish | Galactic Gala studs, angular double zip | South Korea | `SRC-101` |
| `MMKGATA01BK001` | nappa leather | recycled cotton | Bavarian diamond quilting, laptop backpack | Italy | `SRC-102` |
| `MWREAAC01VC001` | cotton canvas + Laurel flocking | leather trim·flap, cotton-linen | 제목은 grained leather, 상세 본체는 canvas | Italy | `SRC-103` |

전체 부품 레코드는 `data/products.jsonl`에 있다. `attribute_state`의 `reported`, `unknown`, `not_applicable`을 함께 읽어야 하며, `null`만으로 “없음”을 뜻하지 않는다.

## 5. 코팅 캔버스: PVC·PU를 읽는 법

MCM 2024 보고서의 카테고리 로드맵은 다음과 같다.

| 유효 시기 | 보고 내용 | 증거 상태 |
| --- | --- | --- |
| `<2022` | standard PVC coated canvas | MCM 보고의 역사적 카테고리 값. 2007 동시대 보도의 `Visetos PVC`와도 부합 |
| `2024` | lower-impact polyurethane(PU) | MCM이 붙인 비교 표현. 공개 SKU별 LCA는 확인하지 못함 |
| `2027` | biomass-derived PU pilot 계획 | 목표값이며 완료값이 아님 |

출처: [MCM Sustainability Report 2024](https://www.mcmworldwide.com/downloads/MCM_sustainability_report_2024.pdf), pp. 53–54, `SRC-009`; [Fashion Insight 2007](https://www.fi.co.kr/main/view.asp?idx=19165), `SRC-015`.

하지만 현행 제품 페이지는 대체로 `Visetos monogram coated canvas`까지만 공개한다. 따라서 제품별 `coating_polymer`는 `null`로 두었고 “현재 모든 Visetos가 PU”라고 자동 입력하지 않는다. `canvas`만으로 기재 섬유를 cotton으로 정하지도 않는다.

## 6. 설계·구조 제품군

| 제품군 | 확인 가능한 시기 | 핵심 설계 | 시간 해석 |
| --- | --- | --- | --- |
| Boston / Ella Boston | 2010-09에 이미 best-selling Boston | 부드러운 travel-trunk/Boston body, top handles, two-way zip, strap, hangtag | Boston의 최초 출시는 2010 이전이지만 정확한 날짜 미확인. Ella 현행 명칭과 분리 |
| Stark | 2013-05-25 이전 존재 | backpack, front/side pockets, laptop sleeve, studded variants | 리테일러 재입고는 최초 출시일 아님 |
| Liz / New Liz | 과거 Liz 정확한 출시 미확인 | lightweight/reversible shopper, side drawstring, detachable pouch | 현행 New Liz 구조만 고신뢰 |
| Tracy | SS21 최소 존재 단서 | satchel, flap, Laurel Lock, zip compartment, convertible strap | 제3자 보존 카탈로그 인덱스 `SRC-062`; 정확한 출시일 아님 |
| Toni | 2021-07 최소 존재 단서 | small geometric shopper, top zip, short handles, detachable strap | 동시기 시장 보고서 `SRC-063`; 정확한 출시일 아님 |
| Mode Travia | 2022-01-26 SS22 소개 | full-grain/nappa leather, logo hardware, trapezoid·satchel | 2023 New Mode Travia는 리뉴얼로 별도 저장 |
| Aren | 2022-09-09 상표 우선권 / 2023-01-11 카탈로그 최소 확인 | crossbody·tote·hobo·backpack을 포괄, modular 변형 | 제3자 법적 집계·카탈로그 `SRC-064`, `SRC-062`; 상표일은 출시일 아님 |
| Himmel | 2023-11-03 Lauretos 판매와 함께 확인 | Lauretos shopper/crossbody, diamond tag, pouch; MIRUM 변형 | 공식 판매 `SRC-005`; 가방 상표 우선권 `SRC-065`와 동명 footwear를 구분 |
| Pina | AW26 | circular Tambourine, stud pattern, tassel, belt/crossbody conversion | 해당 시즌 SKU 스냅샷 |

초기 제품군 연대는 `launch_or_release`와 `first_verified_presence`를 나눴다. 상표 출원일은 제품이 이미 판매된 뒤일 수 있다.

## 7. 제조·공정

### 7.1 MCM에 직접 연결할 수 있는 내용

| 시기·범위 | 확인 공정 | 한계 |
| --- | --- | --- |
| 2007 한국 사업 보도 | 수입 가죽·Visetos PVC·부자재, 본사 재단, 하청 생산 | 당시 역사적 공급망만 설명 |
| 2013 MCM 주력 협력사 | 자재 → 재단 → 배피 → 기리메 → 안감 → 컴퓨터 미싱 → 조립·봉제 → 검품·포장 | 해당 공장의 당시 공정. 현행 전 SKU에 일반화 금지 |
| 2022 MCM 보고서의 재생가죽 설명 | 작은 leather cut-off를 재생가죽으로 처리할 수 있고, shaving scrap을 pulverize → compress → coat/finish해 새 가죽과 유사한 소재로 만든다고 설명 | 기업 수준 폐기물·공정 설명. Resetos나 특정 가방 본체의 배합·공정 증거가 아님 |
| 현행 공식 패턴·SKU | print, emboss, jacquard weaving, quilting, studs, plating | 방식·조건·설비값은 미공개 |
| 2024 보고 | LWG 조달, chrome-free·metal-free 로드맵, 공급사 감사 | 제품별 tannage는 대부분 미공개 |
| 일부 스타일 | NFC/Aura Digital Product Passport가 소재 원산·제조 정보 제공 | 모든 제품에 적용되지 않음 |

역사적 공급사 근거: [한국섬유신문 2013](https://www.ktnews.com/news/articleView.html?idxno=80093), `SRC-016`.

재생가죽 공정 설명: [MCM Sustainability Report 2022](https://www.mcmworldwide.com/information/Press/MCM_2022_Sustainability%20Report_Final.pdf), `SRC-010`. 이 설명과 `Resetos regenerated leather` 상품 표기는 서로 직접 연결되지 않으므로 제품 수준으로 전파하지 않는다.

### 7.2 업계 일반 제혁 공정

OECD·UNIDO 기준의 개념 흐름은 다음과 같다.

`원피 보존 → soaking → unhairing/liming → fleshing/splitting → deliming/bating → pickling → tanning → neutralisation/retanning → dyeing/fatliquoring → drying → buffing/coating/mechanical finishing`

- [OECD Leather Processing](https://www.oecd.org/content/dam/oecd/en/publications/reports/2014/09/leather-processing_g1g4855d/9789264221178-en.pdf), pp. 10–15, `SRC-023`
- [UNIDO Sustainable Leather Manufacture](https://www.unido.org/publications/ot/9653545/pdf), `SRC-025`
- [LWG Modern Leather Making](https://www.leatherworkinggroup.com/learn-more/features/get-to-know-how-modern-leather-is-made/), `SRC-021`

어떤 MCM SKU가 chrome, vegetable, aldehyde, metal-free 또는 chrome-free tannage인지 제품 페이지가 밝히지 않으면 `unknown`이다.

### 7.3 업계 일반 가방 제작 공정

UNIDO의 전통적인 leather-goods 순서는 다음과 같다.

`cutting → splitting → skiving → assembling → sewing → fixing accessories → finishing`

현대화 수단으로 CAD/CAM, laser·waterjet cutting 등이 제시된다. [UNIDO Future Trends](https://downloads.unido.org/ot/26/09/26092957/FutureTrends_b.pdf), pp. 97–98, `SRC-024`.

이 순서는 AI가 손상 위치나 재사용 난이도를 설명할 때 일반 배경으로만 쓸 수 있다. MCM 개별 가방의 확정 BOM·공정 라우팅으로 출력하면 안 된다.

### 7.4 공식 관리 지침

MCM의 현행 Care FAQ는 과중 적재·형태 변형을 피하고, 습기·수분·땀·열·직사광선·알코올·유성 물질·마찰·충격을 피하며, 형태를 유지한 채 더스트백에 넣어 서늘하고 건조한 곳에 보관하고 부드러운 마른 천으로 관리하며 드라이클리닝하지 말 것을 안내한다. 엠보싱 가죽은 마찰에 따른 표면 박리와 중량에 따른 로고 변형, 메탈릭 가죽은 접힘부 주름·균열·변색·분말 전이, 스터드·스톤은 압력 손상과 다른 물체 긁힘을 별도로 경고한다. [MCM Care FAQ](https://us.mcmworldwide.com/en_US/care/ca-care-faq.html), `SRC-092`.

이는 현행 일반 지침 스냅샷이며 제품별 care label과 고객서비스 안내가 우선한다. 손상 유형이 모든 제품에 반드시 발생한다는 예측값으로 사용하지 않는다.

## 8. 조달·LWG·대체 소재 시계열

| 보고·유효 시기 | 값 | 출처·주의 |
| --- | --- | --- |
| 2018– | fur·exotic 소재 중단 | MCM 2024 보고서 pp. 61–62의 기업 보고 |
| 2021 | Metal-Free Tufo leather 도입 | MCM 지속가능성 연혁. 현재 SKU 매핑은 미확인 |
| 2022 스냅샷 | 원피: EU·한국·남아공·미국; 주요 제혁소: 스페인·이탈리아·한국; Tier-1: 이탈리아·한국 | MCM 2022 보고서, `SRC-010` |
| 2023 실적 | 가죽 78%가 최소 LWG Silver 제혁소 | MCM 2024 보고서 |
| 2024 실적 | 가죽 100%를 LWG Gold/Silver 제혁소에서 조달했다고 보고 | MCM 2024 보고서의 기업 주장 |
| 2026-08-21 페이지 | 100% LWG manufacturer, 최소 78% Gold/Silver 문구 | 기간 미표기 하한의 별도 살아 있는 페이지 스냅샷. 2024 정확값 100%와 논리적으로 양립 |
| 2024 실적 | SS25 leather goods 18,690개 chrome-free, 범주의 2.24% | MCM 2024 보고서 pp. 55–56 |
| 2025·2026·2030 | chrome-free 50%·80%·100% 목표 | 달성값 아님 |
| 2024 실적 | MIRUM shopper 422개 | 기업 보고 수치 |
| 2024 실적 | ECONYL 제품 150,119개; GOTS 공급자 유기 소재 제품 15,899개; 인증 재생 polyester 제품 4,820개 | 가방만의 수치로 축소 금지 |

LWG가 실제로 인증하는 주체와 주장 범위는 [LWG FAQ](https://www.leatherworkinggroup.com/learn-more/faqs/)와 [Claims Framework v2.2](https://www.leatherworkinggroup.com/fileadmin/uploads/lwg/Claims_and_Labelling/LWG_Claims_Framework_V2.2.pdf)에 따라 저장했다. v2.2의 제품 로고 자격은 leather가 제품 중량의 50% 이상이고 제품에 쓰인 leather 전량이 LWG 인증 제혁소에서 제조됐을 것을 요구하지만, 소비자 문구에서 특정 제품 가죽이 인증 또는 특정 등급 제혁소산이라고 표현하는 것은 제한한다. 시설 인증은 제품 전체의 환경성, 농장·도축장 동물복지, 완제품 화학 안전성을 포괄 보증하지 않는다.

## 9. 법적 기록

- 캐나다 `VISETOS` 문자상표 1829192: 2017-03-24 출원, 2019-08-12 등록, 2029-08-12 만료 예정. [CIPO](https://ised-isde.canada.ca/cipo/trademark-search/1829192), `SRC-026`.
- 미국 반복 MCM·월계수·리본·다이아몬드 패턴 등록 4,701,887: 2015-03-17 등록. 바로 다음 레코드의 4,843,488은 단일 MCM·월계수 로고 표장이므로 구분한다. [USPTO TTAB filing](https://ttabvue.uspto.gov/ttabvue/ttabvue-91244898-OPP-1.pdf), pp. 10–12, `SRC-027`.

법적 등록일은 패턴의 최초 창작일이나 제품 출시일이 아니다. 시각 유사성만으로 정품 판정을 수행하는 근거도 아니다.

## 10. 공개 근거로 확인하지 못한 값

- Visetos 기재 직물의 정확한 섬유 조성, 직조 조직, 중량
- 개별 Visetos SKU의 PVC/PU 조성, 혼합비, 코팅 두께·도포 횟수
- Visetos 인쇄 방식, 잉크, 인쇄와 topcoat의 순서
- 반복 타일의 실측 치수, 모티프 간격·배율, 패널별 방향·배치, 봉제선 패턴 정합 규칙
- 정품 제작용 벡터 마스터, Pantone·잉크값
- 개별 leather SKU의 chrome·vegetable·aldehyde·metal-free tannage
- Resetos의 정확한 재생 가죽 함량·결합재·동물종·무두질·코팅 조성 및 비건·생분해성 여부
- Vachetta의 동물종·grain 구조·vegetable tannage 여부와 patent leather의 코팅 수지·도포 공정
- crushed·distressed 표면의 생성 조건, perforation·cut-out의 금형·공구·공차, flocking의 섬유·접착제 조성
- 엠보싱 금형 깊이, 온도, 압력, dwell time
- 실 소재·호수·SPI, 손봉제·기계봉제 여부
- 접착제 종류
- 현행 SKU별 edge paint 조성·도포 횟수·sanding·drying 조건
- 금도금 두께와 구체 도금 방식
- 패널 두께, skiving 수치, 심재·보강재 BOM
- 공장별 품질 허용오차와 검사 기준
- Boston, Stark, Liz, Tracy, Toni의 확정 최초 출시일 일부
- 공개 검색 가능한 박물관 소장번호가 붙은 MCM 가방 항목

이 값들은 `unknown`이며, 빈칸을 일반 산업 지식이나 이미지 추정으로 채우면 안 된다.

## 11. AI 지식 베이스 적용 규칙

### 질의 우선순위

1. 정확한 `style_number`가 있으면 `products.jsonl`의 동일 SKU를 우선한다.
2. SKU 근거가 없으면 collection·pattern·family 수준 claim을 사용한다.
3. 브랜드 수준 로드맵은 개별 제품 속성으로 자동 전파하지 않는다.
4. 업계 일반 공정은 `가능한 일반 공정`이라고 표시한다.
5. `unknown` 또는 충돌 claim이 있으면 확정 문장을 만들지 않는다.

### 소재 판정 예

| 입력 | 허용 출력 | 금지 출력 |
| --- | --- | --- |
| `Visetos monogram coated canvas` | Visetos 코팅 캔버스 본체 | 천연가죽 본체, 현재 PU 확정, cotton 확정 |
| `nappa leather` | nappa leather | calf nappa, vegetable-tanned, chrome-free |
| `embossed leather` | 엠보싱 가죽 | full-grain, 특정 동물 종 |
| `microfiber with suede finish` | 스웨이드 촉감의 마이크로화이버 | 동물성 suede leather |
| `Made in Italy` | 완제품 생산국 Italy | 원피·제혁·모든 소재가 Italy |
| `LWG Silver` 제품 문구 | 페이지의 원문 마케팅 문구로 보존하고 적격성·규정 준수는 `unknown` | 인증 제혁소 조달 확정, 제품·브랜드 자체의 LWG 인증·전체 친환경성 |

### 이미지 분석용 표현

- 패턴이 보이면 `visually consistent with` 또는 `후보`로 표현한다.
- Visetos 유사 프린트만으로 소재 수지, 진위, 연식, 정확한 SKU를 확정하지 않는다.
- 공개 로고·상표 설명만으로 정품 반복 타일, 벡터 마스터, 정확한 모티프 비율·간격·색상값을 재구성하지 않는다.
- 그레인·광택·주름은 표면 관찰값으로 저장하고 tannage·동물 종으로 바로 변환하지 않는다.
- 손상 사진에서 구조를 추론할 때 `visible`, `likely`, `unknown`을 분리한다.

## 12. 데이터 완전성과 업데이트

이 버전은 공개 웹에서 확인 가능한 정보의 폭넓은 스냅샷이지 브랜드 내부 PLM·BOM·CAD·공장 SOP의 전수본이 아니다. MCM의 지역별 동적 페이지와 2024 보고서 원문은 직접 비인증 요청에서 Cloudflare 차단이 발생해 검색 인덱스·공개 렌더 경로와 페이지 위치로 교차 확인했다.

업데이트 시에는 기존 값을 덮어쓰기보다 새 `source_id`, `observed_at`, `valid_time`을 추가한다. 수치가 다르더라도 상·하한, 보고기간, 범위가 양립 가능한지 먼저 판정하고, 서로 양립할 수 없는 주장만 `conflict_group_id`로 묶는다.

## 13. 패턴·소재 이미지 레지스트리

공식 MCM 편집·상품 페이지에서 패턴 이미지 92개, 특정 패턴 증거로 사용하지 않는 AW26 편집 맥락 4개, 24개 소재 SKU의 상품 이미지 167개, 합계 263개 참조를 확인했다. 자산 ID를 기준으로 반응형 리사이즈와 DOM 중복을 제거하고, 확인된 동일 응답 바이트 중복 1개도 제거했으며 이미지 파일은 저장소에 복제하지 않았다. 별도 당일 감사에서 소재 167개의 같은 요청 조건 GET 응답 SHA-256을 대조해 바이트 중복이 없음을 확인했지만, 레지스트리에 해시·바이트 수까지 보존한 것은 85개다.

- 패턴: Visetos·AW19 변형, Vintage Monogram Jacquard, Cubic, Lauretos, Maxi Monogram Leather, Disco Visetos, Diamond Jacquard
- 소재·표면: coated canvas+calf nappa, Vachetta trim, calf nappa, full-grain leather, grained calfskin·goatskin, patent, crushed·distressed, suede+Mega Herringbone, perforated calfskin, printed·embossed·cut-out leather, quilted nappa, raffia jacquard, Laurel flocked cotton canvas+leather flap, MIRUM, Resetos regenerated leather, recycled nylon, lambskin, studded calfskin, croco emboss, sequin lambskin
- 전체 메타데이터: `data/pattern_image_references.jsonl`, `data/material_image_references.jsonl`
- 탐색용 대표 갤러리: [IMAGE_INDEX_KO.md](IMAGE_INDEX_KO.md)

모든 참조는 MCM 공식 채널에 게시된 마케팅 이미지지만 권리자와 재사용 허가는 미확인이다. `unknown_reference_only`는 내부 처리 상태이지 저작권·재배포·학습 허가가 아니다. 사진의 조명·보정·축척 때문에 소재 판정 ground truth로 단독 사용하지 않고 반드시 공식 제품 문구와 연결한다. 이미지 `published_at`은 `date_basis`가 편집 페이지 공개일인지 CDN 헤더인지와 함께 읽고, 어느 쪽도 제품 출시일로 승격하지 않는다.
