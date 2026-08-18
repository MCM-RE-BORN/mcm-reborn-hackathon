import type { Metadata } from "next";
import {
  OrdersListScreen,
  resolveDemoState,
  resolveOrderStage,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "신청 내역",
};

type OrdersAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersAliasPage({
  searchParams,
}: OrdersAliasPageProps) {
  const { panel, stage, state } = await searchParams;
  const panelValue = firstValue(panel);
  const stageValue = firstValue(stage);
  const stateValue = firstValue(state);
  const requestedStage =
    stateValue === "canceled"
      ? "canceled"
      : stateValue === "change-request" || panelValue === "change-request"
        ? "change-required"
        : stageValue;
  const resolvedState = resolveDemoState(
    stateValue === "canceled" || stateValue === "change-request"
      ? undefined
      : state,
    ["normal", "loading", "empty", "error", "permission"],
  );

  return (
    <OrdersListScreen
      stage={resolveOrderStage(requestedStage)}
      state={resolvedState}
    />
  );
}
