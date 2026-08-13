import type { Metadata } from "next";
import {
  OrderCompleteScreen,
  resolveDemoState,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "신청 완료",
};

export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: DemoSearchParams;
}) {
  const query = await searchParams;
  const state = resolveDemoState(query.state, [
    "normal",
    "loading",
    "empty",
    "error",
  ]);

  return <OrderCompleteScreen state={state} />;
}
