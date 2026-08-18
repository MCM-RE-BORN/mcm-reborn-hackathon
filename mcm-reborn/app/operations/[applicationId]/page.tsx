import type { Metadata } from "next";
import {
  isOperationApplication,
  OperationsDetailScreen,
  readOperationStatus,
} from "@/components/screens/operations";

export const metadata: Metadata = {
  title: "신청 상세 · 운영 콘솔",
};

type OperationDetailPageProps = {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OperationDetailPage({
  params,
  searchParams,
}: OperationDetailPageProps) {
  const [{ applicationId }, { status }] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <OperationsDetailScreen
      found={isOperationApplication(applicationId)}
      status={readOperationStatus(status)}
    />
  );
}
