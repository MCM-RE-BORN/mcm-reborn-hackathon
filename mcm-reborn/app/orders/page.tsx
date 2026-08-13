import { redirect } from "next/navigation";

type OrdersAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersAliasPage({
  searchParams,
}: OrdersAliasPageProps) {
  const { panel, state } = await searchParams;
  const params = new URLSearchParams();
  const panelValue = firstValue(panel);
  const stateValue = firstValue(state);

  if (panelValue) params.set("panel", panelValue);
  if (stateValue) params.set("state", stateValue);

  redirect(`/orders/demo${params.size ? `?${params.toString()}` : ""}`);
}
