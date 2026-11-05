import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error("MONGO_URI is not defined");
  }

  await mongoose.connect(mongoURI, {
    // Development and tests may build schema indexes automatically.
    // Production indexes must be created through explicit migrations.
    autoIndex: process.env.NODE_ENV !== "production"
  });

  console.log("MongoDB connected successfully");
}