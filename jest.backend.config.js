module.exports = {
  rootDir: __dirname,

  projects: [
    {
      displayName: "backend",
      testEnvironment: "node",

      testPathIgnorePatterns: [
        "/node_modules/",
        ".*\\.int\\.test\\.(js|jsx|ts|tsx)$",
        ".*\\.crud\\.int\\.test\\.(js|jsx|ts|tsx)$",
        "^<rootDir>/client/",
      ],

      // Unit tests: everything except client/ and *.int.* / *.crud.int.*
      testMatch: ["<rootDir>/!(client)/**/*.test.js"],

      // Coverage for backend source
      collectCoverage: true,
      collectCoverageFrom: [
        "config/**/*.js",
        "controllers/**/*.js",
        "helpers/**/*.js",
        "middlewares/**/*.js",
        "models/**/*.js",
        "routes/**/*.js",
      ],
      coverageThreshold: {
        global: { lines: 90, functions: 90 },
      },

      transform: { "^.+\\.[jt]sx?$": "babel-jest" },
    },

    {
      displayName: "integration",
      testEnvironment: "node",

      // Only integration tests
      testMatch: [
        "<rootDir>/**/*.int.test.js",
        "<rootDir>/**/*.crud.int.test.js",
      ],

      // Load env + any global polyfills for integration
      setupFiles: ["dotenv/config", "<rootDir>/jest.polyfills.cjs"],

      // Transpile ESM/TS if present in tests or server code they import
      transform: { "^.+\\.[jt]sx?$": "babel-jest" },

      // Helps chase hanging handles in integration tests
      detectOpenHandles: true,

      testPathIgnorePatterns: ["^<rootDir>/client/", "/node_modules/"],
    },
  ],
};
