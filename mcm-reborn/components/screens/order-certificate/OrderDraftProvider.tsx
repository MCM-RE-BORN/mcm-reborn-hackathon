"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_SCENARIO } from "@/data/demo-scenario";

export type OrderDraft = {
  address: string;
  addressDetail: string;
  name: string;
  phone: string;
  pickupDate: string;
  pickupTime: string;
  postalCode: string;
};

export function formatPickupDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
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

export function formatPickupTimeLabel(value: string) {
  return value === DEMO_SCENARIO.order.pickupTime
    ? DEMO_SCENARIO.order.pickupTimeLabel
    : value;
}

const INITIAL_ORDER_DRAFT: OrderDraft = {
  address: DEMO_SCENARIO.order.customer.address,
  addressDetail: DEMO_SCENARIO.order.customer.addressDetail,
  name: DEMO_SCENARIO.order.customer.name,
  phone: DEMO_SCENARIO.order.customer.phone,
  pickupDate: DEMO_SCENARIO.order.pickupDate,
  pickupTime: DEMO_SCENARIO.order.pickupTime,
  postalCode: DEMO_SCENARIO.order.customer.postalCode,
};

type OrderDraftContextValue = {
  orderDraft: OrderDraft;
  setOrderDraft: (draft: OrderDraft) => void;
};

const OrderDraftContext = createContext<OrderDraftContextValue | null>(null);

export function OrderDraftProvider({ children }: { children: ReactNode }) {
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(INITIAL_ORDER_DRAFT);
  const value = useMemo(
    () => ({ orderDraft, setOrderDraft }),
    [orderDraft],
  );

  return (
    <OrderDraftContext.Provider value={value}>
      {children}
    </OrderDraftContext.Provider>
  );
}

export function useOrderDraft() {
  const context = useContext(OrderDraftContext);

  if (!context) {
    throw new Error("useOrderDraft must be used within OrderDraftProvider");
  }

  return context;
}
