
import jwt from "jsonwebtoken";

export function generateAccessToken(userId: string): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short");
  }

  return jwt.sign(
    { userId },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "60m"
    }
  );
}
