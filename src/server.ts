
import "dotenv/config";
import { ZodError } from "zod";
import app from "./app";
import { connectDB } from "./config/database";
import { validateEnv } from "./config/env";

const PORT: number = 3000;

async function startServer(): Promise<void> {
  try {
    validateEnv();

    await connectDB();

    app.listen(PORT, () => {
      console.log(`Poolr API running on port ${PORT}`);
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const invalidFields = error.issues.map(
        (issue) => issue.path.join(".")
      );

      console.error(
        "Invalid environment configuration:",
        [...new Set(invalidFields)].join(", ")
      );
    } else {
      console.error("Failed to start Poolr API");
    }

    process.exit(1);
  }
}

void startServer();
