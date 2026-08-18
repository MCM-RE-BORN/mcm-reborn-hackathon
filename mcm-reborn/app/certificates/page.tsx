import { redirect } from "next/navigation";

type CertificatesAliasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
