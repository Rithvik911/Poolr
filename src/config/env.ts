
import { z } from "zod";

export const envSchema = z.object({
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters")
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env
): Env {
  return envSchema.parse(env);
}
