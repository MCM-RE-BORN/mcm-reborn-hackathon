-- Roll back only when the application is also being returned to the affected
-- pre-hotfix implementation. Applying this rollback reintroduces the SHIPPED
-- transition defect and is not recommended independently. In other words,
-- this rollback reintroduces the SHIPPED transition defect.

begin;

do $rollback$
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

  if position('on conflict (application_id)' in lower(function_definition)) > 0 then
    return;
  end if;

  if position('on conflict on constraint mock_shipments_application_id_key' in lower(function_definition)) = 0 then
    raise exception 'advance_application_lifecycle has an unknown shipment upsert shape';
  end if;

  function_definition := replace(
    function_definition,
    'on conflict on constraint mock_shipments_application_id_key',
    'on conflict (application_id)'
  );
  function_definition := replace(
    function_definition,
    'ON CONFLICT ON CONSTRAINT mock_shipments_application_id_key',
    'ON CONFLICT (application_id)'
  );

  execute function_definition;
end
$rollback$;

commit;
