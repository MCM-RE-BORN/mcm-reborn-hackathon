import type { Metadata } from "next";
import {
  OrderDetailsScreen,
  resolveDemoState,
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
  const requestedState =
    query.panel === "change-request" ? "change-request" : query.state;
  const state = resolveDemoState(requestedState, [
    "normal",
    "loading",
    "empty",
    "error",
    "permission",
    "change-request",
    "canceled",
  ]);

  return <OrderDetailsScreen state={state} />;
}
