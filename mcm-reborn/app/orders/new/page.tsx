import type { Metadata } from "next";
import {
  OrderNewScreen,
  resolveDemoState,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "업사이클링 신청",
};

export default async function OrderNewPage({
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
    "permission",
  ]);

  return <OrderNewScreen state={state} />;
}
