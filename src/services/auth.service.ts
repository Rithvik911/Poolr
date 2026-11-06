import { generateAccessToken } from "../utils/jwt";
import bcrypt from "bcrypt";
import { UserModel } from "../models/user.model";
import type {
  RegisterInput,
  LoginInput,
} from "../validators/auth.validator";

// Used when an email is not registered so failed logins perform comparable
// bcrypt work and do not reveal account existence through response timing.
const DUMMY_PASSWORD_HASH =
  "$2b$12$oQr.KviMAiTOL/miK3gAPescx82PTs2H2/DLptxKP4Ph2YHyZexfW";

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

  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
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
