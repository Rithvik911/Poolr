
import bcrypt from "bcrypt";
import { UserModel } from "../models/user.model.js";
import type { RegisterInput } from "../validators/auth.validator.js";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailAlreadyExistsError";
  }
}
export async function registerUser(input: RegisterInput) {
  // Check whether this email is already registered
  const existingUser = await UserModel.findOne({
    email: input.email
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
    passwordHash
  });

  // Return only safe user information
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email
  };
}
