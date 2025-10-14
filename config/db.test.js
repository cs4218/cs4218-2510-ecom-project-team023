// config/db.test.js
import connectDB from "./db.js";
import mongoose from "mongoose";

// Mock the ESM default export so `mongoose.connect` is a jest.fn()
jest.mock("mongoose", () => ({
  __esModule: true,
  default: { connect: jest.fn() },
}));

describe("connectDB", () => {
  const ORIG_ENV = process.env;
  let logSpy, errSpy;

  beforeEach(() => {
    process.env = {
      ...ORIG_ENV,
      NODE_ENV: "test",
      MONGO_URL: "mongodb://localhost/testdb",
    };
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    process.env = ORIG_ENV;
  });

  it("connects with MONGO_URL and logs a connected message", async () => {
    // @ts-ignore – we know we mocked it above
    mongoose.connect.mockResolvedValue({ connection: { host: "mock-host" } });

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URL, {}); // 2 args
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("[DB] Connected:");
  });

  it("throws in test env and logs the error when connection fails", async () => {
    // @ts-ignore
    mongoose.connect.mockRejectedValueOnce(new Error("boom"));

    await expect(connectDB()).rejects.toThrow("boom");

    const erred = errSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(erred).toContain("Connection error");
    expect(erred).toContain("boom");
  });
});
