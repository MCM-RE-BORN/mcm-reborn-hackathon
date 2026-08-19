-- Fix the QUALITY_CHECK -> SHIPPED RPC on an already provisioned v2 database.
-- The function returns a column named application_id, so PL/pgSQL treats the
-- unqualified ON CONFLICT (application_id) target as ambiguous.

begin;

do $migration$
declare
  lifecycle_function regprocedure := to_regprocedure(
    'public.advance_application_lifecycle(uuid,public.application_status,text,text,text,text)'
  );
  function_definition text;
begin
  if lifecycle_function is null then
    raise exception 'advance_application_lifecycle v2 RPC is missing';
  end if;

  select pg_get_functiondef(lifecycle_function)
  into function_definition;

  if position('on conflict on constraint mock_shipments_application_id_key' in lower(function_definition)) > 0 then
    return;
  end if;

  if position('on conflict (application_id)' in lower(function_definition)) = 0 then
    raise exception 'advance_application_lifecycle has an unknown shipment upsert shape';
  end if;

  function_definition := replace(
    function_definition,
    'on conflict (application_id)',
    'on conflict on constraint mock_shipments_application_id_key'
  );
  function_definition := replace(
    function_definition,
    'ON CONFLICT (application_id)',
    'ON CONFLICT ON CONSTRAINT mock_shipments_application_id_key'
  );

  execute function_definition;
end
$migration$;

commit;
