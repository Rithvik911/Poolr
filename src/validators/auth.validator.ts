import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),

  email: z.email().trim().toLowerCase(),
  isDriver: z.boolean().default(false),

  password: z.string()
    .min(8)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "Password must not exceed 72 bytes"
    )
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),

  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginSchema>;
