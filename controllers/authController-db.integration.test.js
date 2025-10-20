import request from "supertest";
import userModel from "../models/userModel.js";
import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../config/testdb.js";

// mock the DB connection to use mongodb-memory-server later
// jest.mock(require.resolve("../config/db.js"), () => ({
//   __esModule: true,
//   default: async () => {
//     const m = (await import("mongoose")).default;
//     await m.connect(process.env.MONGO_URL, { dbName: "ecom_auth_int" });
//   },
// }));

const resolveApp = async () => {
  const srvMod = await import("../server.js");
  const candidates = [
    srvMod,
    srvMod?.default,
    srvMod?.default?.default,
    srvMod?.app,
    srvMod?.default?.app,
    srvMod?.server,
    srvMod?.default?.server,
  ];
  const isExpress = (x) => typeof x === "function" && (x.handle || x.use);
  const isHttp = (x) =>
    x && typeof x.address === "function" && typeof x.close === "function";
  for (const c of candidates) {
    if (!c) continue;
    if (isExpress(c) || isHttp(c)) return c;
    if (typeof c === "function" && !c.handle && !c.address) {
      try {
        const maybe = c();
        if (isExpress(maybe) || isHttp(maybe)) return maybe;
        if (maybe?.app && isExpress(maybe.app)) return maybe.app;
        if (maybe?.server && isHttp(maybe.server)) return maybe.server;
      } catch {}
    }
  }
  throw new Error("Could not resolve Express app/http.Server from server.js");
};

let app;

beforeAll(async () => {
  await connectToTestDb("authController_db_int");

  app = await resolveApp();
});

afterAll(async () => {
  disconnectFromTestDb();
});

// global beforeEach to clear users collection
beforeEach(async () => {
  await resetTestDb();
});

describe("RegisterController and Database integration tests", () => {
  test("should register a new user successfully", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "example",
      email: "example@example.com",
      password: "strongpass",
      phone: "91234567",
      address: "123 Test Street",
      answer: "Football",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("User registered successfully");

    // verify user saved in DB
    const user = await userModel.findOne({ email: "example@example.com" });

    expect(user).not.toBeNull();
    expect(user.name).toBe("example");
    expect(user.password).not.toBe("strongpass");
  });

  test("should fail if any required field is missing", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "Missing required fields: Name, Email, Password, Phone, Address, Answer"
    );
  });

  test("should fail if password length < 6", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Short Pass",
      email: "short@example.com",
      password: "123",
      phone: "91234567",
      address: "Short Street",
      answer: "Football",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Password must be at least 6 characters long"
    );
  });

  test("should fail if user already exists", async () => {
    await userModel.create({
      name: "Existing User",
      email: "exist@example.com",
      password: "hashedpass",
      phone: "91234567",
      address: "123 Existing",
      answer: "Football",
    });

    const res = await request(app).post("/api/v1/auth/register").send({
      name: "New User",
      email: "exist@example.com", // duplicate email
      password: "strongpass",
      phone: "99999999",
      address: "Another Street",
      answer: "Basketball",
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("User already registered, please login");
  });
});

// use actual hashPassword fn to ensure proper integration across components
import { hashPassword } from "../helpers/authHelper.js";

describe("LoginController and Database integration tests", () => {
  test("should login successfully with valid credentials", async () => {
    const hashedPassword = await hashPassword("strongpass");
    const user = await userModel.create({
      name: "Login User",
      email: "login@example.com",
      password: hashedPassword,
      phone: "91234567",
      address: "123 Login Street",
      answer: "Football",
    });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "login@example.com",
      password: "strongpass",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("login successfully");
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("login@example.com");
    expect(res.body.user._id).toBe(user._id.toString());
  });

  test("should fail if email or password is missing", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("No email or password provided");
  });

  test("should fail if email is not registered", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "notfound@example.com",
      password: "somepass",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Email is not registered");
  });

  test("should fail if password is incorrect", async () => {
    const hashedPassword = await hashPassword("correctpass");
    await userModel.create({
      name: "Wrong Pass User",
      email: "wrongpass@example.com",
      password: hashedPassword,
      phone: "91234567",
      address: "Wrong Street",
      answer: "Football",
    });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "wrongpass@example.com",
      password: "wrongpass123", // wrong password
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid Password");
  });
});

describe("ForgotPasswordController and Database integration tests", () => {
  test("should reset password successfully with valid email, answer and strong new password", async () => {
    const oldHashed = await hashPassword("oldpassword");
    const user = await userModel.create({
      name: "Forgot User",
      email: "forgot@example.com",
      password: oldHashed,
      phone: "91234567",
      address: "123 Forgot Street",
      answer: "Football",
    });

    const res = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "forgot@example.com",
      answer: "Football",
      newPassword: "newStrongPass",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Password Reset Successfully");

    const updated = await userModel.findById(user._id);
    expect(updated).not.toBeNull();
    expect(updated.password).not.toBe(oldHashed); // password should change
  });

  test("should fail if any required field is missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "Missing required fields: Email, Answer, New Password"
    );
  });

  test("should fail if email or answer does not match any user", async () => {
    await userModel.create({
      name: "Wrong Answer",
      email: "wrong@example.com",
      password: await hashPassword("oldpass"),
      phone: "91234567",
      address: "Wrong Street",
      answer: "Basketball",
    });

    const res = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "wrong@example.com",
      answer: "Football", // incorrect
      newPassword: "newpass123",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Wrong Email Or Answer");
  });

  test("should fail if new password is too short", async () => {
    const oldHashed = await hashPassword("oldpass");
    await userModel.create({
      name: "Short Password User",
      email: "shortpw@example.com",
      password: oldHashed,
      phone: "91234567",
      address: "Short Street",
      answer: "Football",
    });

    const res = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "shortpw@example.com",
      answer: "Football",
      newPassword: "123", // too short
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "Password must be at least 6 characters long"
    );
  });
});

import JWT from "jsonwebtoken";

describe("TestController integration test", () => {
  test("should return Protected Routes message", async () => {
    // admin user to generate token
    const user = await userModel.create({
      name: "Test User",
      email: "test@example.com",
      password: await hashPassword("testpass"),
      phone: "91234567",
      address: "Test Street",
      answer: "Football",
      role: 1,
    });
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET);

    const res = await request(app)
      .get("/api/v1/auth/test")
      .set("Authorization", token);

    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Protected Routes");
  });
});

describe("UpdateProfileController and Database integration tests", () => {
  test("should update user profile successfully with valid data", async () => {
    const hashedPassword = await hashPassword("oldpassword");
    const user = await userModel.create({
      name: "Old Name",
      email: "update@example.com",
      password: hashedPassword,
      phone: "91234567",
      address: "Old Address",
      answer: "Football",
    });
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        name: "New Name",
        address: "New Address",
        phone: "99999999",
      })
      .set("user-id", user._id.toString());

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Profile updated successfully");
    expect(res.body.updatedUser.name).toBe("New Name");
    expect(res.body.updatedUser.address).toBe("New Address");
    expect(res.body.updatedUser.phone).toBe("99999999");

    const updatedUser = await userModel.findById(user._id);
    expect(updatedUser.name).toBe("New Name");
  });

  test("should fail if password length < 6", async () => {
    const hashedPassword = await hashPassword("oldpassword");
    const user = await userModel.create({
      name: "Short Pass User",
      email: "shortpass@example.com",
      password: hashedPassword,
      phone: "91234567",
      address: "Short Street",
      answer: "Football",
    });
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        password: "123", // too short
      })
      .set("user-id", user._id.toString());

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Password is required and 6 characters long");
  });

  test("should update password when valid new password is provided", async () => {
    const oldHashed = await hashPassword("oldpassword");
    const user = await userModel.create({
      name: "Pass User",
      email: "pass@example.com",
      password: oldHashed,
      phone: "91234567",
      address: "Pass Street",
      answer: "Football",
    });
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET);

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({
        password: "newstrongpass",
      })
      .set("user-id", user._id.toString());

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Profile updated successfully");

    const updated = await userModel.findById(user._id);
    expect(updated.password).not.toBe(oldHashed); // password changed
  });

  test("should fail if there is an unexpected error from the database", async () => {
    const user = await userModel.create({
      name: "Test User",
      email: "test@example.com",
      password: await hashPassword("testpass"),
      phone: "91234567",
      address: "Test Street",
      answer: "Football",
      role: 1,
    });
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET);

    // delete the user to cause an error during update in database
    await userModel.deleteMany({});

    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", token)
      .send({})
      .set("user-id", "invalid-user-id");

    expect([400, 500]).toContain(res.statusCode);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch("Error while updating profile");
  });
});
