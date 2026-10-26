
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).json({
      message: "Authorization header missing"
    });
    return;
  }

  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    res.status(401).json({
      message: "Invalid authorization format"
    });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    console.error("JWT_SECRET is missing or too short");

    res.status(500).json({
      message: "Authentication service unavailable"
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    });

    if (
      typeof payload === "string" ||
      typeof payload.userId !== "string"
    ) {
      res.status(401).json({
        message: "Invalid token payload"
      });
      return;
    }

    res.locals.userId = payload.userId;

    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired token"
    });
  }
}