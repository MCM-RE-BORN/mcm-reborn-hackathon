import type { Metadata } from "next";
import {
  CertificateScreen,
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
  const requestedState = Array.isArray(query.state)
    ? query.state[0]
    : query.state;
  const requestedVerification = Array.isArray(query.verify)
    ? query.verify[0]
    : query.verify;
  const verification =
    requestedVerification === "nfc" || requestedVerification === "qr"
      ? requestedVerification
      : undefined;
  const exceptionalStates = [
    "loading",
    "empty",
    "error",
    "permission",
    "locked",
  ] as const;
  const exceptionalState = exceptionalStates.find(
    (candidate) => candidate === requestedState,
  );
  const state =
    requestedState === "issued" ? "normal" : (exceptionalState ?? "locked");

  return <CertificateScreen state={state} verification={verification} />;
}
