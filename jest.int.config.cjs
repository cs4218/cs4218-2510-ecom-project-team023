module.exports = {
  displayName: "integration",
  testEnvironment: "node",
  testMatch: ["**/*.int.test.js", "**/*.crud.int.test.js"],
  setupFiles: ["dotenv/config", "<rootDir>/jest.polyfills.cjs"],
  transform: { "^.+\\.[jt]sx?$": "babel-jest" }, // transpile ESM imports in tests & server code
  detectOpenHandles: true,
};
