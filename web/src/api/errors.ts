export interface NormalizedError {
  code: string;
  message: string;
  details: unknown;
  requestId?: string;
  status: number;
  retrySafeWithSameKey?: boolean;
}

export class ApiError extends Error implements NormalizedError {
  code: string;
  details: unknown;
  requestId?: string;
  status: number;
  retrySafeWithSameKey?: boolean;

  constructor(error: NormalizedError) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.status = error.status;
    this.retrySafeWithSameKey = error.retrySafeWithSameKey;
  }
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

export function normalizeApiError(body: unknown, status: number, fallback = "Something went wrong"): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const error = body.error;
    const details = error.details ?? {};
    return new ApiError({
      status,
      code: typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      message: typeof error.message === "string" ? error.message : fallback,
      details,
      requestId: typeof error.requestId === "string" ? error.requestId : undefined,
      retrySafeWithSameKey:
        isRecord(details) && typeof details.retrySafeWithSameKey === "boolean"
          ? details.retrySafeWithSameKey
          : undefined,
    });
  }

  if (isRecord(body) && body.success === false) {
    return new ApiError({
      status,
      code: typeof body.code === "string" ? body.code : "REQUEST_FAILED",
      message: typeof body.message === "string" ? body.message : fallback,
      details: isRecord(body.details) ? body.details : {},
    });
  }

  return new ApiError({ status, code: "REQUEST_FAILED", message: fallback, details: {} });
}

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Couldn’t reach Poolr. Check that the API is running.";
  const messages: Record<string, string> = {
    RATE_LIMITED: "Too many tries for now. Take a short breather and try again.",
    EMAIL_TAKEN: "That email already has a Poolr account. Try signing in instead.",
    INVALID_CREDENTIALS: "That email and password don’t match.",
    SEATS_UNAVAILABLE: "Those seats were just taken. Pick fewer seats or another ride.",
    RIDE_NOT_BOOKABLE: "This ride can’t take bookings now.",
    OWN_RIDE: "You can’t book your own ride.",
    DUPLICATE_BOOKING: "You already have a booking on this ride.",
    PICKUP_DROPOFF_NOT_ON_ROUTE: "Those points don’t sit in the right order on this route.",
    IDEMPOTENCY_KEY_REUSED: "That booking attempt changed. Please start a fresh attempt.",
    SERVICE_BUSY: "Poolr is busy. Your booking can be retried safely.",
  };
  return messages[error.code] ?? error.message;
}
