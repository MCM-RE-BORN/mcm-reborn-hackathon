import type { Metadata } from "next";
import {
  CheckoutScreen,
  resolveDemoState,
  type CheckoutOrderDraft,
  type DemoSearchParams,
} from "@/components/screens/order-certificate";
import { DEMO_SCENARIO } from "@/data/demo-scenario";

export const metadata: Metadata = {
  title: "주문 확인 및 결제",
};

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function containsUnsafeCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    return (
      codePoint <= 31 ||
      codePoint === 127 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    );
  });
}

function readText(
  value: SearchValue,
  fallback: string,
  maxLength: number,
  pattern?: RegExp,
) {
  const candidate = firstValue(value)?.trim();

  if (
    !candidate ||
    candidate.length > maxLength ||
    containsUnsafeCharacter(candidate) ||
    (pattern && !pattern.test(candidate))
  ) {
    return fallback;
  }

  return candidate;
}

function pickupDateLabel(value: SearchValue) {
  const fallback = DEMO_SCENARIO.order.pickupDate;
  const candidate = readText(value, fallback, 10, /^\d{4}-\d{2}-\d{2}$/);
  const [year, month, day] = candidate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    year >= 2026 &&
    year <= 2027 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isValid
    ? `${year}년 ${month}월 ${day}일`
    : DEMO_SCENARIO.order.pickupDateLabel;
}

function readOrderDraft(
  query: Awaited<DemoSearchParams>,
): CheckoutOrderDraft {
  const { customer, pickupTimeLabel } = DEMO_SCENARIO.order;

  return {
    address: readText(query.address, customer.address, 120),
    addressDetail: readText(query.addressDetail, customer.addressDetail, 80),
    customerName: readText(
      query.customerName,
      customer.name,
      40,
      /^[\p{L}\p{M} .'-]+$/u,
    ),
    customerPhone: readText(
      query.customerPhone,
      customer.phone,
      24,
      /^(?=.{7,24}$)[0-9+() -]+$/,
    ),
    pickupDateLabel: pickupDateLabel(query.pickupDate),
    pickupTimeLabel: readText(
      query.pickupTime,
      pickupTimeLabel,
      32,
      /^(?=.{3,32}$)[가-힣0-9 :~–-]+$/,
    ),
    postalCode: readText(
      query.postalCode,
      customer.postalCode,
      10,
      /^\d{5}$/,
    ),
  };
}

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
  const orderDraft = readOrderDraft(query);

  return <CheckoutScreen orderDraft={orderDraft} state={state} />;
}
