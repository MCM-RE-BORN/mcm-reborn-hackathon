import type { Metadata } from "next";
import {
  OrderDetailsScreen,
  resolveCancellationReason,
  resolveDemoState,
  resolveOrderStage,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "신청 내역",
};

export default async function OrderDetailsPage({
  searchParams,
}: {
  searchParams: DemoSearchParams;
}) {
  const query = await searchParams;
  const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const legacyState = firstValue(query.state);
  const legacyPanel = firstValue(query.panel);
  const requestedStage =
    legacyState === "canceled"
      ? "canceled"
      : legacyState === "change-request" || legacyPanel === "change-request"
        ? "change-required"
        : query.stage;
  const state = resolveDemoState(
    legacyState === "canceled" || legacyState === "change-request"
      ? undefined
      : query.state,
    [
    "normal",
    "loading",
    "empty",
    "error",
    "permission",
    ],
  );
  const stage = resolveOrderStage(requestedStage);
  const cancellationReason = resolveCancellationReason(query.reason);

  return (
    <OrderDetailsScreen
      cancellationReason={cancellationReason}
      stage={stage}
      state={state}
    />
  );
}
