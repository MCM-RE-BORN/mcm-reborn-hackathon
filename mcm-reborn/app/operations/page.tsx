import type { Metadata } from "next";
import {
  OperationsListScreen,
  readOperationStatus,
} from "@/components/screens/operations";

export const metadata: Metadata = {
  title: "운영 · 장인 콘솔",
};

type OperationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OperationsPage({
  searchParams,
}: OperationsPageProps) {
  const { state, status } = await searchParams;
  const stateValue = Array.isArray(state) ? state[0] : state;

  return (
    <OperationsListScreen
      empty={stateValue === "empty"}
      status={readOperationStatus(status)}
    />
  );
}
