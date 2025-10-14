// config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  const uri =
    process.env.MONGO_URL ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/virtualvault_e2e";

  try {
    const conn = await mongoose.connect(uri, {}); // note second arg {}
    console.log(`[DB] Connected: ${uri}`);
    return conn;
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("[DB] Connection error:", msg);
    if (process.env.NODE_ENV === "test") {
      // In tests, throw instead of exiting so Jest can assert the error
      throw err;
    }
    process.exit(1); // in dev/prod, fail fast
  }
};

export default connectDB;
