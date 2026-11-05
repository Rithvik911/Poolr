import { generateAccessToken } from "../utils/jwt";
import bcrypt from "bcrypt";
import { UserModel } from "../models/user.model";
import type {
  RegisterInput,
  LoginInput,
} from "../validators/auth.validator";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailAlreadyExistsError";
  }
}
export async function registerUser(input: RegisterInput) {
  // Check whether this email is already registered
  const existingUser = await UserModel.findOne({
    email: input.email,
  });

  if (existingUser) {
    throw new EmailAlreadyExistsError();
  }

  // Hash the password before storing it
  const passwordHash = await bcrypt.hash(input.password, 12);

  // Save the new user in MongoDB
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    isDriver: input.isDriver,
  });

  // Return only safe user information
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isDriver: user.isDriver,
  };
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export async function loginUser(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email }).select(
    "+passwordHash",
  );

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  // Generate an access token after successful authentication
  const accessToken = generateAccessToken(user._id.toString());

  return {
    accessToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isDriver: user.isDriver,
    },
  };
}
