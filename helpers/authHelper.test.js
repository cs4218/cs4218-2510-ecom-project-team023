import bcrypt from "bcrypt";
import { hashPassword, comparePassword } from "./authHelper";

jest.mock("bcrypt"); // mock bcrypt module

const plainPassword = "MySecurePassword123!";
const mockHashedPassword = "$2b$10$ABCDEFGHIJKLMNOPQRSTUVWX1234567890abcdefghi";

describe("authHelper utility functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("hashPassword should hash a password successfully", async () => {
    bcrypt.hash.mockResolvedValueOnce(mockHashedPassword);

    const result = await hashPassword(plainPassword);

    expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
    expect(result).toBe(mockHashedPassword);
  });

  test("hashPassword should log and return undefined if bcrypt.hash throws error", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    bcrypt.hash.mockRejectedValueOnce(new Error("hashing failed"));

    const result = await hashPassword(plainPassword);

    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBeUndefined();

    consoleSpy.mockRestore();
  });

  test("comparePassword should return true for matching password", async () => {
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await comparePassword(plainPassword, mockHashedPassword);

    expect(bcrypt.compare).toHaveBeenCalledWith(
      plainPassword,
      mockHashedPassword
    );
    expect(result).toBe(true);
  });

  test("comparePassword should return false for non-matching password", async () => {
    bcrypt.compare.mockResolvedValueOnce(false);

    const result = await comparePassword("wrong_password", mockHashedPassword);

    expect(result).toBe(false);
  });

  test("comparePassword should reject if bcrypt.compare throws", async () => {
    bcrypt.compare.mockRejectedValueOnce(new Error("compare failed"));

    await expect(comparePassword("abc", mockHashedPassword)).rejects.toThrow(
      "compare failed"
    );
  });

  // boundary test
  test("hashPassword should handle empty password input", async () => {
    bcrypt.hash.mockResolvedValueOnce("hashed_empty");

    const result = await hashPassword("");

    expect(bcrypt.hash).toHaveBeenCalledWith("", 10);
    expect(result).toBe("hashed_empty");
  });

  // boundary test
  test("hashpassword should handle very long password input", async () => {
    const longPassword = "a".repeat(1000);
    bcrypt.hash.mockResolvedValueOnce("hashed_long"); // mock long password hash

    const result = await hashPassword(longPassword);

    expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
    expect(result).toBe("hashed_long");
  });
});
