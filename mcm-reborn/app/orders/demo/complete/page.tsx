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
  const applicationId = typeof query.applicationId === "string" ? query.applicationId : undefined;
  const state = resolveDemoState(query.state, [
    "normal",
    "loading",
    "empty",
    "error",
    "permission",
  ]);

  return <OrderCompleteScreen applicationId={applicationId} state={state} />;
}
