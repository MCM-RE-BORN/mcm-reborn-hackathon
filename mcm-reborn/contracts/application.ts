import { z } from 'zod';

/**
 * Application status enum
 */
export const ApplicationStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PENDING_APPROVAL',
  'APPROVED',
  'RECEIVING_PRODUCT',
  'PRODUCT_RECEIVED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'COMPLETED',
  'ADDITIONAL_REVIEW_REQUIRED',
  'PRODUCTION_UNAVAILABLE',
  'CANCELED',
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/**
 * Shipment status enum
 */
export const ShipmentStatusSchema = z.enum([
  'PICKUP_RESERVED',
  'PICKUP_IN_PROGRESS',
  'AT_WORKSHOP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

/**
 * Timeline step state
 */
export type TimelineStepState = 'COMPLETED' | 'CURRENT' | 'UPCOMING' | 'EXCEPTION';

/**
 * Timeline step
 */
export interface TimelineStep {
  status: ApplicationStatus;
  label: string;
  state: TimelineStepState;
  occurredAt?: string | null;
  description?: string | null;
}

/**
 * Address
 */
export interface Address {
  recipientName: string;
  phone: string;
  postalCode: string;
  address1: string;
  address2?: string | null;
}

/**
 * User role
 */
export type UserRole = 'CUSTOMER' | 'OPERATOR';

/**
 * User
 */
export interface User {
  id: string;
  role: UserRole;
  displayName: string;
  email: string;
}
