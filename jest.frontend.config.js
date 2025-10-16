// jest.frontend.config.js
const path = require("path");

module.exports = {
  rootDir: path.resolve(__dirname, "client"),

  projects: [
    // ===== UNIT (browser) =====
    {
      displayName: "frontend",
      testEnvironment: "jsdom",
      transform: { "^.+\\.[jt]sx?$": "babel-jest" },
      moduleNameMapper: { "\\.(css|less|scss|sass)$": "identity-obj-proxy" },

      testMatch: ["<rootDir>/client/src/!(_*)/**/*.test.[jt]s?(x)"],
      testPathIgnorePatterns: [
        "/node_modules/",
        ".*\\.int\\.test\\.(js|jsx|ts|tsx)$",
        ".*\\.crud\\.int\\.test\\.(js|jsx|ts|tsx)$",
      ],

      // coverage only for unit
      collectCoverage: true,
      collectCoverageFrom: ["<rootDir>/src/!(_*)/**", "!<rootDir>/src/**/*.test.[jt]sx?"],
      coverageThreshold: { global: { lines: 90, functions: 90 } },

      setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
    },

    // ===== INTEGRATION (node + Mongo) =====
    {
      displayName: "frontend-integration",
      testEnvironment: "node",

      transform: { "^.+\\.[jt]sx?$": "babel-jest" },

      // Let babel-jest transpile ESM deps used by mongodb/memory-server
      transformIgnorePatterns: [
        "/node_modules/(?!(mongodb|bson|mongodb-memory-server|mongodb-memory-server-core|@mongodb-js)/)",
      ],

      setupFiles: ["<rootDir>/jest.polyfills.cjs"],

      testMatch: [
        "<rootDir>/client/src/**/*.int.test.[jt]s?(x)",
        "<rootDir>/cleint/src/**/*.crud.int.test.[jt]s?(x)",
      ],

      moduleNameMapper: { "\\.(css|less|scss|sass)$": "identity-obj-proxy" },
      testPathIgnorePatterns: ["/node_modules/"],
    },
  ],
};
