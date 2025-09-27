import {
  registerController,
  loginController,
  forgotPasswordController,
  testController,
} from "./authController.js";
import userModel from "../models/userModel.js";
import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import JWT from "jsonwebtoken";

// Mock dependencies
jest.mock("../models/userModel.js");
jest.mock("../helpers/authHelper.js");
jest.mock("jsonwebtoken");

// Mock data
const MOCK_REQUEST_BODY = {
  DOB: "1990-01-01",
  name: "Alice",
  email: "alice.tan@example.com",
  password: "password",
  phone: "+65 9123 4567",
  address: "alice's address",
  answer: "My first pet's name",
};

const MOCK_USER_DATA = {
  _id: "64f6c8f4b4dcbf001c8e4a2b",
  name: "Alice",
  email: "alice.tan@example.com",
  password: "$2b$10$N9qo8uLOickgx2ZMRZo4i.ej8fZt5sh9F0D3lJH7Yi9Pa1e7t2Q.e", // bcrypt hash
  phone: "+65 9123 4567",
  address: "alice's address",
  answer: "My first pet's name",
  role: 0, // normal user
  createdAt: "2025-09-27T08:15:30.000Z",
  updatedAt: "2025-09-27T08:15:30.000Z",
  __v: 0,
};

describe("Auth Controller Tests", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("registerController", () => {
    it("should return error if email missing", async () => {
      mockReq.body = { ...MOCK_REQUEST_BODY, email: "" };
      await registerController(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith({
        message: "Email is Required",
      });
    });

    it("should return error if existing user", async () => {
      userModel.findOne.mockResolvedValue(MOCK_USER_DATA);

      mockReq.body = MOCK_REQUEST_BODY;
      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User already registered, please login",
        })
      );
    });

    it("should register new user", async () => {
      userModel.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashedpassword");
      userModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(MOCK_USER_DATA),
      }));

      mockReq.body = MOCK_REQUEST_BODY;

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: MOCK_USER_DATA,
        })
      );
    });
  });

  describe("loginController", () => {
    it("should fail if user not found", async () => {
      userModel.findOne.mockResolvedValue(null);

      mockReq.body = { email: "a@test.com", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email is not registerd",
        })
      );
    });

    it("should login successfully", async () => {
      userModel.findOne.mockResolvedValue({
        _id: "u1",
        email: "a@test.com",
        password: "hashed123",
        name: "John",
        phone: "999",
        address: "Street",
        role: 0,
      });
      comparePassword.mockResolvedValue(true);
      JWT.sign.mockReturnValue("tok123");

      mockReq.body = { email: "a@test.com", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, token: "tok123" })
      );
    });
  });

  describe("forgotPasswordController", () => {
    it("should fail if user not found", async () => {
      userModel.findOne.mockResolvedValue(null);
      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Wrong Email Or Answer",
        })
      );
    });
  });

  describe("testController", () => {
    it("should send protected routes message", () => {
      testController(mockReq, mockRes);
      expect(mockRes.send).toHaveBeenCalledWith("Protected Routes");
    });
  });
});
