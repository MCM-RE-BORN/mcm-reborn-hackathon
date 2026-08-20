# 공개 조사·크롤 로그

기준일: `2026-08-21` (Asia/Seoul)

## 수집 방식

1. MCM 글로벌·지역별 HTML sitemap과 검색 색인을 통해 역사, 컬렉션, 제품, 지속가능성, DPP URL을 발견했다.
2. 접근 가능한 공개 HTML을 열어 제목, 시즌, SKU, body·trim·lining·hardware, 구조, Made in을 확인했다.
3. 2022·2024 MCM 보고서는 공개 PDF URL과 검색 색인의 페이지별 텍스트를 대조했다.
4. LWG, OECD, UNIDO, CIPO, USPTO 같은 기관 원문으로 용어·일반 공정·법적 날짜를 교차 검증했다.
5. 동시대 업계·패션 매체는 공식 페이지에 없는 최초 확인 시점과 역사적 공급사 공정만 보완했다.
6. 원문 페이지·이미지 전체를 복제하지 않고 URL, 날짜, locator와 한국어 의역만 저장했다.

## 검색 축

- `MCM Visetos history logo laurel diamond 1976`
- `site:mcmworldwide.com MCM Cubic Monogram craftsmanship`
- `site:mcmworldwide.com MCM Lauretos SS24 monogram`
- `site:mcmworldwide.com MCM bag nappa calfskin goatskin lambskin`
- `site:mcmworldwide.com MCM embossed quilted jacquard studded leather`
- `site:mcmworldwide.com MCM sustainability report leather LWG chrome-free PVC PU`
- `MCM bag factory cutting skiving edge painting sewing Korea`
- `MCM Boston Stark Liz Tracy Toni Aren Mode Travia Himmel launch`
- `VISETOS trademark repeating pattern USPTO CIPO`
- `LWG full grain Napa certification product claims`
- `OECD UNIDO leather processing leather goods cutting skiving sewing`

## 수집 결과

- 출처 레코드: 61개
- 원자형 claim: 70개
- 공식 대표 SKU 스냅샷: 24개
- 명시적 공식 충돌 그룹: 2개
- 확인 기준일: 모든 레코드 `2026-08-21`

숫자는 이 버전의 레코드 수이며 인터넷상의 전체 문서 수를 뜻하지 않는다.

## 접근 제약

- `us.mcmworldwide.com/robots.txt`와 MCM 2024 보고서 PDF에 대한 직접 비인증 HTTP 요청은 Cloudflare 403 challenge로 차단됐다.
- 로그인, CAPTCHA 우회, anti-bot 우회, 대량 요청은 시도하지 않았다.
- 검색 색인과 공개 웹 렌더로 확인 가능한 부분만 사용했다.
- 동적 제품 페이지는 품절·시즌·지역에 따라 사라지거나 내용이 달라질 수 있다.
- 제품 사진과 원문 페이지를 로컬에 보관하지 않았으므로 미래 재현 시 URL이 사라질 수 있다.
- `published_at`이 없는 살아 있는 페이지는 `null`; 확인일만 보존했다.

## 범위에서 제외한 자료

- 출처가 불명확한 블로그·AI 생성 요약
- 진위나 연대를 판매자가 임의 표기한 개인 리셀 게시물
- 공개 근거 없이 작성된 공장 공정·재료 배합 추정
- 원문을 확인할 수 없는 검색 결과 snippet 하나만의 세부 주장
- 유료벽 뒤에 있어 핵심 문장을 검증하지 못한 자료

## 재크롤 규칙

- 동일 URL이 갱신돼도 과거 claim을 덮어쓰지 않는다.
- 새 관찰은 새 claim 또는 새 source snapshot으로 추가한다.
- SKU의 `Made in`, raw material string, 시즌, DPP 범위가 달라지면 변경시점을 기록한다.
- 목표 연도가 지나면 달성값을 별도 근거로 확인할 때까지 목표 상태를 유지한다.
- LWG certificate는 시설명·등급·유효기간을 확인할 수 있을 때만 시설 엔터티에 연결한다.
