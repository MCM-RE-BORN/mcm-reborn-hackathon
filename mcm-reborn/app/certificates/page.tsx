import { redirect } from "next/navigation";

import { firstValue } from "@/lib/search-params";
type CertificatesAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CertificatesAliasPage({
  searchParams,
}: CertificatesAliasPageProps) {
  const { state, verify } = await searchParams;
  const stateValue = firstValue(state);
  const verifyValue = firstValue(verify);
  const params = new URLSearchParams();

  if (stateValue) params.set("state", stateValue);
  if (verifyValue) params.set("verify", verifyValue);

  redirect(`/certificates/demo${params.size ? `?${params.toString()}` : ""}`);
}
