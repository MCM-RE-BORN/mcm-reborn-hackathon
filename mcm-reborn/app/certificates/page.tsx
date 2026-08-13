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
  const { state } = await searchParams;
  const stateValue = firstValue(state);
  const params = new URLSearchParams();

  if (stateValue) params.set("state", stateValue);

  redirect(`/certificates/demo${params.size ? `?${params.toString()}` : ""}`);
}
