import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { MongoServerError } from "mongodb";
import { AppError } from "../errors/app-error";
import { UserModel } from "../models/user.model";
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  loginUser,
  registerUser,
} from "../services/auth.service";
import {
  loginSchema,
  registerSchema,
} from "../validators/auth.validator";

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    next(
      new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid registration data",
        details: result.error.flatten(),
      }),
    );
    return;
  }

  try {
    const registration = await registerUser(result.data);

    res.status(201).json(registration);
  } catch (error) {
    if (
      error instanceof EmailAlreadyExistsError ||
      (error instanceof MongoServerError &&
        error.code === 11000 &&
        Object.prototype.hasOwnProperty.call(
          error.keyPattern ?? {},
          "email",
        ))
    ) {
      next(
        new AppError({
          statusCode: 409,
          code: "EMAIL_TAKEN",
          message: "Email already registered",
        }),
      );
      return;
    }

    next(error);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    next(
      new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid login data",
        details: result.error.flatten(),
      }),
    );
    return;
  }

  try {
    const loginResult = await loginUser(result.data);

    res.status(200).json(loginResult);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      next(
        new AppError({
          statusCode: 401,
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        }),
      );
      return;
    }

    next(error);
  }
}

export async function getMeController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await UserModel.findById(res.locals.userId);

    if (!user) {
      next(
        new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "User not found",
        }),
      );
      return;
    }

    res.status(200).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        isDriver: user.isDriver,
      },
    });
  } catch (error) {
    next(error);
  }
}