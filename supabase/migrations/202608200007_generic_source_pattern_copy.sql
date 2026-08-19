begin;

update public.products
set description = '고객 원제품의 패턴과 소재를 살린 여권지갑입니다.'
where code = 'REBORN_PASSPORT_WALLET';

commit;
