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
  const { state } = await searchParams;
  const resolvedState = resolveDemoState(
    state,
    ["normal", "loading", "empty", "error", "permission"],
  );

  return <OrdersListScreen state={resolvedState} />;
}
