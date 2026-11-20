import { randomUUID } from "node:crypto";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

const MAX_REQUEST_ID_LENGTH = 128;
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

function getRequestId(req: Request): string {
  const suppliedRequestId = req.get("X-Request-Id")?.trim();

  if (
    suppliedRequestId &&
    suppliedRequestId.length <= MAX_REQUEST_ID_LENGTH &&
    VALID_REQUEST_ID.test(suppliedRequestId)
  ) {
    return suppliedRequestId;
  }

  return randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = getRequestId(req);

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
}