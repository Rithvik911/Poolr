export type ErrorCode =
  | "VALIDATION_ERROR"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "SEATS_UNAVAILABLE"
  | "RIDE_NOT_BOOKABLE"
  | "OWN_RIDE"
  | "DUPLICATE_BOOKING"
  | "INVALID_STATE_TRANSITION"
  | "IDEMPOTENCY_KEY_REUSED"
  | "PICKUP_DROPOFF_NOT_ON_ROUTE"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "SERVICE_BUSY";

interface AppErrorOptions {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor({
    statusCode,
    code,
    message,
    details,
  }: AppErrorOptions) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, AppError);
  }
}