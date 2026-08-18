/**
 * Standard error response structure following OpenAPI contract
 */
export interface ErrorResponse {
  error: ErrorObject;
}

export interface ErrorObject {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
      details: details ?? {},
    },
  };
}

/**
 * Custom error types
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('RESOURCE_NOT_FOUND', 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, 409, message, details);
    this.name = 'ConflictError';
  }
}

export class ImageQualityInsufficientError extends AppError {
  constructor(public imageQualityIssues: Array<{
    assetId: string;
    code: string;
    guidanceKo: string;
  }>) {
    super(
      'IMAGE_QUALITY_INSUFFICIENT',
      422,
      '이미지 품질이 분석 기준을 충족하지 않습니다. 안내에 따라 다시 촬영해 주세요.',
      {
        imageQuality: {
          status: 'RECAPTURE_REQUIRED',
          issues: imageQualityIssues,
        },
        retryable: true,
      }
    );
    this.name = 'ImageQualityInsufficientError';
  }
}

export class AuthenticityReviewRequiredError extends AppError {
  constructor(
    analysisId: string,
    manualReviewCaseId: string
  ) {
    super(
      'AUTHENTICITY_REVIEW_REQUIRED',
      422,
      '정품 여부 판정 없이 운영자 수동 검토가 필요합니다. 검토가 끝날 때까지 신청을 생성할 수 없습니다.',
      {
        analysisId,
        authenticitySignal: 'REVIEW_REQUIRED',
        applicationCreationBlocked: true,
        manualReviewCaseId,
        manualReviewStatus: 'PENDING',
        nextAction: 'AWAIT_MANUAL_REVIEW',
      }
    );
    this.name = 'AuthenticityReviewRequiredError';
  }
}
