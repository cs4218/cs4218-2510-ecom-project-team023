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
const MOCK_REGISTER_REQUEST_BODY = {
  DOB: "1990-01-01",
  name: "Alice",
  email: "alice.tan@example.com",
  password: "password",
  phone: "+65 9123 4567",
  address: "alice's address",
  answer: "My first pet's name",
};

const MOCK_REGISTER_USER_DATA = {
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
    jest.clearAllMocks();
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe("registerController", () => {
    it("should return error if any required fields is/are missing", async () => {
      mockReq.body = {};
      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message:
          "Missing required fields: Name, Email, Password, Phone, Address, Answer",
      });
    });

    it("should return error if there is an existing user", async () => {
      userModel.findOne.mockResolvedValue(MOCK_REGISTER_USER_DATA);

      mockReq.body = MOCK_REGISTER_REQUEST_BODY;
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
        save: jest.fn().mockResolvedValue(MOCK_REGISTER_USER_DATA),
      }));

      mockReq.body = MOCK_REGISTER_REQUEST_BODY;

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: MOCK_REGISTER_USER_DATA,
        })
      );
    });

    it("should handle errors", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);

      mockReq.body = MOCK_REGISTER_REQUEST_BODY;
      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error while registering user",
          error,
        })
      );
    });
  });

  describe("loginController", () => {
    it("should fail if email missing", async () => {
      mockReq.body = { email: "", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    it("should fail if password missing", async () => {
      mockReq.body = { email: "a@test.com", password: "" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    it("should fail if user not found", async () => {
      userModel.findOne.mockResolvedValue(null);

      mockReq.body = { email: "a@test.com", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email is not registered",
        })
      );
    });

    it("should fail if password mismatch", async () => {
      userModel.findOne.mockResolvedValue({
        _id: "u1",
        email: "a@test.com",
        password: "hashed123",
        name: "John",
        phone: "999",
        address: "Street",
        role: 0,
      });
      comparePassword.mockResolvedValue(false);

      mockReq.body = { email: "a@test.com", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid Password",
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

      let mockUser = {
        _id: "u1",
        name: "John",
        email: "a@test.com",
        phone: "999",
        address: "Street",
        role: 0,
      };

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "login successfully",
          user: mockUser,
          token: "tok123",
        })
      );
    });

    it("should handle errors", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);

      mockReq.body = { email: "a@test.com", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error in login",
          error,
        })
      );
    });
  });

  describe("forgotPasswordController", () => {
    it("should fail if any field is missing", async () => {
      mockReq.body = {};
      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields: Email, Answer, New Password",
      });
    });

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

    it("should reset password successfully", async () => {
      userModel.findOne.mockResolvedValue({ _id: "u1" });
      hashPassword.mockResolvedValue("hashednew123");
      userModel.findByIdAndUpdate.mockResolvedValue(true);

      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password Reset Successfully",
        })
      );
    });

    it("should handle errors", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);

      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Something went wrong",
          error,
        })
      );
    });
  });

  describe("testController", () => {
    it("should send protected routes message", () => {
      testController(mockReq, mockRes);
      expect(mockRes.send).toHaveBeenCalledWith("Protected Routes");
    });

    it("should handle errors", () => {
      const error = new Error("Test error");
      const badRes = {
        send: () => {
          throw error;
        },
        status: jest.fn().mockReturnThis(),
      };

      expect(() => testController(mockReq, badRes)).toThrow("Test error");
    });
  });
});
