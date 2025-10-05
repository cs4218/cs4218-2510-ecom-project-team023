// config/db.test.js
import mongoose from "mongoose";
import connectDB from "./db"; // <-- fixed: import the actual file

jest.mock("mongoose", () => ({ connect: jest.fn() }));

describe("connectDB", () => {
  const ORIG_ENV = process.env;
  let logSpy;

  beforeEach(() => {
    process.env = { ...ORIG_ENV, MONGO_URL: "mongodb://localhost/testdb" };
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env = ORIG_ENV;
  });

  it("connects with MONGO_URL and logs the connected host", async () => {
    mongoose.connect.mockResolvedValue({ connection: { host: "mock-host" } });

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URL);
    const logged = logSpy.mock.calls.flat().join("\n"); // colored string safe
    expect(logged).toContain("Connected To Mongodb Database");
    expect(logged).toContain("mock-host");
  });

  it("logs an error message when connection fails", async () => {
    mongoose.connect.mockRejectedValueOnce(new Error("boom"));

    await connectDB();

    const logged = logSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("Error in Mongodb");
    expect(logged).toContain("boom");
  });
});
