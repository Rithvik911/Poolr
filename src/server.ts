
import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/database.js";

const PORT: number = 3000;

async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Poolr API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start Poolr API:", error);
    process.exit(1);
  }
}

void startServer();
