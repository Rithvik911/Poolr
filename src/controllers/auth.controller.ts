import type { Request, Response } from "express";
import { registerSchema } from "../validators/auth.validator.js";
import {
  registerUser,
  EmailAlreadyExistsError,
} from "../services/auth.service.js";
import { MongoServerError } from "mongodb";

export async function registerController(
  req: Request,
  res: Response,
): Promise<void> {
  // Validate incoming request data
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid registration data",
      errors: result.error.flatten(),
    });
    return;
  }

  try {
    // Call the registration service
    const user = await registerUser(result.data);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    if (
      error instanceof EmailAlreadyExistsError ||
      (error instanceof MongoServerError &&
        error.code === 11000 &&
        Object.prototype.hasOwnProperty.call(error.keyPattern ?? {}, "email"))
    ) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    console.error("Registration failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to register user",
    });
  }
}
