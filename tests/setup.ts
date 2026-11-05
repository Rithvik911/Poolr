import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectDB } from "../src/config/database";

beforeAll(async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error("Test MONGO_URI is missing");
  }

  const databaseName = new URL(mongoURI).pathname.slice(1);

  if (databaseName !== "poolr_test") {
    throw new Error(
      `Refusing to run tests against database "${databaseName}"`
    );
  }

  await connectDB();
});

beforeEach(async () => {
  const collections = Object.values(mongoose.connection.collections);

  await Promise.all(
    collections.map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});