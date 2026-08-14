import type { Metadata } from "next";
import {
  CertificateScreen,
  resolveDemoState,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";

export const metadata: Metadata = {
  title: "디지털 ESG Passport",
};

export default async function CertificatePage({
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
    "locked",
  ]);

  return <CertificateScreen state={state} />;
}
