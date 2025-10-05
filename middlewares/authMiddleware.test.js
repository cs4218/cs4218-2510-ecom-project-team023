import JWT from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { requireSignIn, isAdmin } from "./authMiddleware.js";

jest.mock("jsonwebtoken");
jest.mock("../models/userModel.js");

describe("Auth Middleware Tests", () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {
        authorization: "Bearer mocktoken",
      },
      user: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("requireSignIn function unit tests", () => {
    test("should verify token, attach user to req, and call next", async () => {
      const mockDecoded = {
        _id: "mock_id",
        iat: 1234567890,
        exp: 1234567890 + 3600,
      };

      JWT.verify.mockReturnValue(mockDecoded);

      await requireSignIn(mockReq, mockRes, mockNext);

      expect(JWT.verify).toHaveBeenCalledWith(
        mockReq.headers.authorization,
        process.env.JWT_SECRET
      );
      expect(mockReq.user).toEqual(mockDecoded);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test("should log error and not call next if verification fails", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      JWT.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await requireSignIn(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleSpy.mock.calls[0][0].message).toBe("Invalid token");
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error: expect.any(Error),
        message: "Error during sign in verification",
      });

      consoleSpy.mockRestore();
    });

    test("should handle missing authorization header gracefully", async () => {
      mockReq.headers.authorization = undefined;
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      JWT.verify.mockImplementation(() => {
        throw new Error("jwt must be provided");
      });

      await requireSignIn(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleSpy.mock.calls[0][0].message).toBe("jwt must be provided");
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error: expect.any(Error),
        message: "Error during sign in verification",
      });

      consoleSpy.mockRestore();
    });
  });

  describe("isAdmin function unit tests", () => {
    test("should call next if user has admin role (role=1)", async () => {
      mockReq.user = { _id: "admin123" };
      userModel.findById.mockResolvedValue({ _id: "admin123", role: 1 });

      await isAdmin(mockReq, mockRes, mockNext);

      expect(userModel.findById).toHaveBeenCalledWith("admin123");
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should send 401 if user is not admin", async () => {
      mockReq.user = { _id: "user123" };
      userModel.findById.mockResolvedValue({ _id: "user123", role: 0 });

      await isAdmin(mockReq, mockRes, mockNext);

      expect(userModel.findById).toHaveBeenCalledWith("user123");
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Unauthorized Access",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should send 401 and log error if DB lookup throws error", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      mockReq.user = { _id: "errorUser" };
      userModel.findById.mockRejectedValue(new Error("DB error"));

      await isAdmin(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error: expect.any(Error),
        message: "Error during admin verification",
      });
      expect(mockNext).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test("should handle missing req.user gracefully", async () => {
      mockReq.user = null;
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      userModel.findById.mockImplementation(() => {
        throw new Error("User undefined");
      });

      await isAdmin(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(Error),
          message: "Error during admin verification",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
