import { NextResponse } from 'next/server';
import {
  AppError,
  ServiceUnavailableError,
  createErrorResponse,
} from '@/contracts/errors';
import { SupabaseConfigurationError } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

/**
 * Handle errors and return appropriate HTTP response
 */
export function handleApiError(error: unknown): NextResponse {
  const requestId = randomUUID();

  const normalizedError = error instanceof SupabaseConfigurationError
    ? new ServiceUnavailableError(
      'Supabase integration is not configured',
      { retryable: false },
    )
    : error;

  // Do not log request bodies, tokens or upstream error objects. Those can
  // include customer data or authorization headers.
  console.error('[API Error]', {
    requestId,
    code: normalizedError instanceof AppError
      ? normalizedError.code
      : 'INTERNAL_ERROR',
    name: normalizedError instanceof Error
      ? normalizedError.name
      : 'UnknownError',
  });

  if (normalizedError instanceof AppError) {
    return NextResponse.json(
      createErrorResponse(
        normalizedError.code,
        normalizedError.message,
        requestId,
        normalizedError.details,
      ),
      {
        headers: { 'Cache-Control': 'no-store' },
        status: normalizedError.statusCode,
      }
    );
  }

  // Unknown errors
  return NextResponse.json(
    createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      requestId
    ),
    {
      headers: { 'Cache-Control': 'no-store' },
      status: 500,
    }
  );
}
