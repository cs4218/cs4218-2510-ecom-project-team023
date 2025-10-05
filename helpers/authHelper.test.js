import { hashPassword, comparePassword } from "./authHelper.js";

describe("Password Helper Functions", () => {
  const plainPassword = "MySecureTestingPassword123!";

  test("hashPassword should return a hashed string different from the original", async () => {
    const hashed = await hashPassword(plainPassword);

    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe(plainPassword);
    expect(hashed.length).toBeGreaterThan(0);
  });

  test("comparePassword should return true for correct password", async () => {
    const hashed = await hashPassword(plainPassword);
    const isMatch = await comparePassword(plainPassword, hashed);

    expect(isMatch).toBe(true);
  });

  test("comparePassword should return false for incorrect password", async () => {
    const hashed = await hashPassword(plainPassword);
    const isMatch = await comparePassword("WrongPassword", hashed);

    expect(isMatch).toBe(false);
  });

  test("hashPassword should throw or log error if input is invalid", async () => {
    await expect(hashPassword(null)).resolves.toBeUndefined();
    await expect(hashPassword("")).resolves.toBeDefined();
  });
});
