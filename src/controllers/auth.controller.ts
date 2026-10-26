import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import {
  registerUser,
  EmailAlreadyExistsError,
  loginUser,
  InvalidCredentialsError,
} from "../services/auth.service.js";
import { MongoServerError } from "mongodb";
import {UserModel} from "../models/user.model.js";

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

export async function loginController(
  req: Request,
  res: Response
): Promise<void> {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid login data",
      errors: result.error.flatten()
    });
    return;
  }

  try {
    const loginResult = await loginUser(result.data);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: loginResult
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
      return;
    }

    console.error("Login failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to log in"
    });
  }
}


export async function getMeController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = res.locals.userId;

    const user = await UserModel.findById(userId);

    if (!user) {
      res.status(404).json({
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Get profile failed:", error);

    res.status(500).json({
      message: "Unable to fetch user profile"
    });
  }
}
