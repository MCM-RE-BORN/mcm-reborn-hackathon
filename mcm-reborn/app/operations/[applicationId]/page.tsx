import type { Metadata } from "next";
import {
  isOperationApplication,
  OperationsDetailScreen,
} from "@/components/screens/operations";

export const metadata: Metadata = {
  title: "신청 상세 · 운영 콘솔",
};

type OperationDetailPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function OperationDetailPage({
  params,
}: OperationDetailPageProps) {
  const { applicationId } = await params;

  return (
    <OperationsDetailScreen
      applicationId={applicationId}
      found={isOperationApplication(applicationId)}
    />
  );
}
