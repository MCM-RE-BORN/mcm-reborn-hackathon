import type { Metadata } from "next";
import {
  OrdersListScreen,
  resolveDemoState,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "신청 내역",
};

type OrdersAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersAliasPage({
  searchParams,
}: OrdersAliasPageProps) {
  const { state, view } = await searchParams;
  const resolvedState = resolveDemoState(
    state,
    ["normal", "loading", "empty", "error", "permission"],
  );
  const resolvedView = (Array.isArray(view) ? view[0] : view) === "analyses"
    ? "analyses"
    : "applications";

  return <OrdersListScreen state={resolvedState} view={resolvedView} />;
}
