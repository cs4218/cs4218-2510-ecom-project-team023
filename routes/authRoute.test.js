// routes/authRoute.test.js
import express from "express";
import request from "supertest";

// --- Mock controllers (named exports) ---
jest.mock("../controllers/authController.js", () => ({
  registerController: jest.fn((req, res) =>
    res.status(201).json({ message: "register" })
  ),
  loginController: jest.fn((req, res) =>
    res.status(200).json({ message: "login" })
  ),
  forgotPasswordController: jest.fn((req, res) =>
    res.status(200).json({ message: "forgot-password" })
  ),
  testController: jest.fn((req, res) =>
    res.status(200).json({ message: "test" })
  ),
  updateProfileController: jest.fn((req, res) =>
    res.status(200).json({ message: "update-profile" })
  ),
  getOrdersController: jest.fn((req, res) =>
    res.status(200).json({ message: "orders" })
  ),
  getAllOrdersController: jest.fn((req, res) =>
    res.status(200).json({ message: "all-orders" })
  ),
  orderStatusController: jest.fn((req, res) =>
    res.status(200).json({ message: "order-status" })
  ),
  getAllUsersController: jest.fn((req, res) =>
    res.status(200).json({ message: "users" })
  ),
}));

// --- Mock middlewares ---
jest.mock("../middlewares/authMiddleware.js", () => ({
  requireSignIn: jest.fn((req, _res, next) => {
    req.user = { _id: "u1", role: 1 };
    next();
  }),
  isAdmin: jest.fn((_req, _res, next) => next()),
}));

// Import AFTER mocks so the router gets the mocked deps
import router from "./authRoute.js";
import {
  registerController,
  loginController,
  forgotPasswordController,
  testController,
  updateProfileController,
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
  getAllUsersController,
} from "../controllers/authController.js";
import { requireSignIn, isAdmin } from "../middlewares/authMiddleware.js";

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", router);
  return app;
};

describe("authRoute wiring & middleware", () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = makeApp();
  });

  // Unprotected endpoints
  it("POST /register -> registerController", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "e@x.com", password: "pw" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: "register" });
    expect(registerController).toHaveBeenCalledTimes(1);
    expect(requireSignIn).not.toHaveBeenCalled();
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it("POST /login -> loginController", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "e@x.com", password: "pw" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "login" });
    expect(loginController).toHaveBeenCalledTimes(1);
  });

  it("POST /forgot-password -> forgotPasswordController", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "e@x.com", answer: "a", newPassword: "p" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "forgot-password" });
    expect(forgotPasswordController).toHaveBeenCalledTimes(1);
  });

  // “Ping” auth endpoints with inline handlers
  it("GET /user-auth requires sign-in and returns {ok:true}", async () => {
    const res = await request(app).get("/api/v1/auth/user-auth");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it("GET /admin-auth requires sign-in + admin and returns {ok:true}", async () => {
    const res = await request(app).get("/api/v1/auth/admin-auth");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(1);
  });

  // Protected controller endpoints
  it("GET /test uses requireSignIn, isAdmin, then testController", async () => {
    const res = await request(app).get("/api/v1/auth/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "test" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(1);
    expect(testController).toHaveBeenCalledTimes(1);
  });

  it("PUT /profile -> updateProfileController (requireSignIn)", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "update-profile" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(updateProfileController).toHaveBeenCalledTimes(1);
  });

  it("GET /orders -> getOrdersController (requireSignIn)", async () => {
    const res = await request(app).get("/api/v1/auth/orders");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "orders" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(getOrdersController).toHaveBeenCalledTimes(1);
  });

  it("GET /all-orders -> getAllOrdersController (requireSignIn + isAdmin)", async () => {
    const res = await request(app).get("/api/v1/auth/all-orders");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "all-orders" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(1);
    expect(getAllOrdersController).toHaveBeenCalledTimes(1);
  });

  it("PUT /order-status/:orderId -> orderStatusController (requireSignIn + isAdmin)", async () => {
    const res = await request(app)
      .put("/api/v1/auth/order-status/xyz123")
      .send({ status: "Shipped" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "order-status" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(1);
    expect(orderStatusController).toHaveBeenCalledTimes(1);
  });

  it("GET /users -> getAllUsersController (requireSignIn + isAdmin)", async () => {
    const res = await request(app).get("/api/v1/auth/users");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "users" });
    expect(requireSignIn).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(1);
    expect(getAllUsersController).toHaveBeenCalledTimes(1);
  });

  // One negative/authorization example to show middleware gatekeeping
  it("GET /all-orders returns 403 when isAdmin blocks", async () => {
    isAdmin.mockImplementationOnce((req, res) =>
      res.status(403).json({ error: "forbidden" })
    );
    const res = await request(app).get("/api/v1/auth/all-orders");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "forbidden" });
    expect(getAllOrdersController).not.toHaveBeenCalled();
  });
});
