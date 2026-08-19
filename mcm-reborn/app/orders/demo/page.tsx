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
  const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const applicationId = firstValue(query.applicationId);
  const state = resolveDemoState(
    query.state,
    [
    "normal",
    "loading",
    "empty",
    "error",
    "permission",
    ],
  );

  return (
    <OrderDetailsScreen
      applicationId={applicationId}
      state={state}
    />
  );
}
