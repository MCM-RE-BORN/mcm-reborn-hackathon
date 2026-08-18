import type { Metadata } from "next";
import {
  CheckoutScreen,
  resolveDemoState,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "주문 확인 및 결제",
};

export default async function CheckoutPage({
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
    "canceled",
  ]);

  return <CheckoutScreen state={state} />;
}
