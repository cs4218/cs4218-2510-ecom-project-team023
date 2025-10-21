import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

// Connect to an in-memory MongoDB server for testing
export async function connectToTestDb(dbName = "jest-test") {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, { dbName });
  return uri;
}

// Clear all collections in the test database
export async function resetTestDb() {
  const { collections } = mongoose.connection;
  const tasks = Object.values(collections).map((collection) =>
    collection.deleteMany({}).catch(() => {})
  );
  await Promise.all(tasks);
}

// Disconnect and stop the in-memory MongoDB server
export async function disconnectFromTestDb() {
  try {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  } catch {
    // ignore
  }
  if (mongoServer) {
    try {
      await mongoServer.stop();
    } catch {
      // ignore
    }
    mongoServer = undefined;
  }
}