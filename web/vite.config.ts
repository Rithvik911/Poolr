import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_DEV_API_TARGET || "http://localhost:3000";
  const apiPrefix = env.VITE_API_PREFIX || "/v1";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        [apiPrefix]: apiTarget,
        "/health": apiTarget,
        "/ready": apiTarget,
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      include: ["src/**/*.test.{ts,tsx}"],
      css: true,
    },
  };
});
