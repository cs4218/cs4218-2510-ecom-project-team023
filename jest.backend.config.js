export default {
  displayName: "backend",
  testEnvironment: "node",

  // Run all test files ending with .test.js
  testMatch: ["<rootDir>/**/*.test.js"],

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
    global: {
      lines: 90,
      functions: 90,
    },
  },
};
