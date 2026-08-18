import type { Metadata } from "next";
import {
  MyPageScreen,
  resolveDemoState,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "마이페이지",
};

export default async function MyPage({
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

  return <MyPageScreen state={state} />;
}
