import bcrypt from "bcrypt";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { UserModel } from "../src/models/user.model";
import jwt from "jsonwebtoken";

const validUser = {
  name: "Test User",
  email: "auth.integration@example.com",
  password: "TestPass123!",
};

describe("Authentication integration", () => {
  it("registers a user and stores a password hash", async () => {
    // Importing app lets Supertest exercise Express without opening a real port.
    const response = await request(app).post("/auth/register").send(validUser);

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      success: true,
      message: "User registered successfully",
      data: {
        name: validUser.name,
        email: validUser.email,
      },
    });

    expect(response.body.data.id).toEqual(expect.any(String));

    // Registration responses must never expose password information.
    expect(response.body.data).not.toHaveProperty("password");
    expect(response.body.data).not.toHaveProperty("passwordHash");

    // passwordHash is excluded from normal queries by the model.
    const savedUser = await UserModel.findOne({
      email: validUser.email,
    }).select("+passwordHash");

    expect(savedUser).not.toBeNull();

    // bcrypt.compare proves the stored value is a valid hash of the password.
    const passwordMatches = await bcrypt.compare(
      validUser.password,
      savedUser!.passwordHash,
    );

    expect(passwordMatches).toBe(true);
  });
  it("registers a user with driver capability", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({
        ...validUser,
        email: "driver@example.com",
        isDriver: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.isDriver).toBe(true);

    const savedUser = await UserModel.findOne({
      email: "driver@example.com",
    });

    expect(savedUser).not.toBeNull();
    expect(savedUser!.isDriver).toBe(true);
  });
  it("rejects registration when the email already exists", async () => {
    const firstResponse = await request(app)
      .post("/auth/register")
      .send(validUser);

    expect(firstResponse.status).toBe(201);

    const duplicateResponse = await request(app)
      .post("/auth/register")
      .send(validUser);

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({
      success: false,
      message: "Email already registered",
    });

    // A rejected duplicate must not create another database document.
    const matchingUsers = await UserModel.countDocuments({
      email: validUser.email,
    });

    expect(matchingUsers).toBe(1);
  });

  it("rejects invalid registration data without creating a user", async () => {
    const response = await request(app).post("/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Invalid registration data",
    });

    expect(response.body.errors).toBeDefined();

    // Validation should fail before any database document is created.
    const userCount = await UserModel.countDocuments();
    expect(userCount).toBe(0);
  });

  it("logs in a registered user and returns an access token", async () => {
    await request(app).post("/auth/register").send(validUser).expect(201);

    const response = await request(app).post("/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "Login successful",
      data: {
        user: {
          name: validUser.name,
          email: validUser.email,
        },
      },
    });

    expect(response.body.data.user.id).toEqual(expect.any(String));
    expect(response.body.data.accessToken).toEqual(expect.any(String));

    const tokenPayload = jwt.decode(response.body.data.accessToken);

    expect(tokenPayload).not.toBeNull();
    expect(typeof tokenPayload).not.toBe("string");

    if (
      !tokenPayload ||
      typeof tokenPayload === "string" ||
      typeof tokenPayload.iat !== "number" ||
      typeof tokenPayload.exp !== "number"
    ) {
      throw new Error("Access token is missing numeric iat or exp claims");
    }

    expect(tokenPayload.exp - tokenPayload.iat).toBe(60 * 60);

    // Login responses must not expose stored authentication credentials.
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });
  it("rejects login when the password is incorrect", async () => {
    await request(app).post("/auth/register").send(validUser).expect(201);

    const response = await request(app).post("/auth/login").send({
      email: validUser.email,
      password: "WrongPassword123!",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });

    expect(response.body).not.toHaveProperty("data");
    expect(response.body).not.toHaveProperty("accessToken");
  });
  it("rejects login when the email is not registered", async () => {
    const response = await request(app).post("/auth/login").send({
      email: "missing.user@example.com",
      password: "TestPass123!",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });

    expect(response.body).not.toHaveProperty("data");
    expect(response.body).not.toHaveProperty("accessToken");
  });
  it("returns the current user for a valid access token", async () => {
    await request(app).post("/auth/register").send(validUser).expect(201);

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: validUser.email,
        password: validUser.password,
      })
      .expect(200);

    const accessToken = loginResponse.body.data.accessToken;
    const loggedInUser = loginResponse.body.data.user;

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: loggedInUser.id,
        name: validUser.name,
        email: validUser.email,
        isDriver: false,
      },
    });

    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });
  it("rejects profile access without an authorization header", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authorization header missing",
    });
  });
  it("rejects an invalid authorization format", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", "Basic invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid authorization format",
    });
  });
  it("rejects profile access with an invalid token", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid.token.value");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid or expired token",
    });
  });
  it("rejects profile access with an expired token", async () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("Test JWT_SECRET is missing");
    }

    // A negative lifetime creates a correctly signed token that is already expired.
    const expiredToken = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      secret,
      {
        algorithm: "HS256",
        expiresIn: -1,
      },
    );

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid or expired token",
    });
  });
  it("returns 404 when the token user no longer exists", async () => {
    await request(app).post("/auth/register").send(validUser).expect(201);

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: validUser.email,
        password: validUser.password,
      })
      .expect(200);

    const accessToken = loginResponse.body.data.accessToken;
    const userId = loginResponse.body.data.user.id;

    // Simulate an account being deleted while its previously issued JWT still exists.
    await UserModel.findByIdAndDelete(userId);

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "User not found",
    });
  });
});
