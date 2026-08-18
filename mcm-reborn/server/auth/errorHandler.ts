import { NextResponse } from 'next/server';
import { AppError, createErrorResponse } from '@/contracts/errors';
import { randomUUID } from 'crypto';

/**
 * Handle errors and return appropriate HTTP response
 */
export function handleApiError(error: unknown): NextResponse {
  const requestId = randomUUID();

  console.error('[API Error]', { requestId, error });

  if (error instanceof AppError) {
    return NextResponse.json(
      createErrorResponse(error.code, error.message, requestId, error.details),
      { status: error.statusCode }
    );
  }

  // Unknown errors
  return NextResponse.json(
    createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      requestId
    ),
    { status: 500 }
  );
}
