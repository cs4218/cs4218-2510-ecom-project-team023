export default {
  displayName: "backend",
  testEnvironment: "node",

  // Run only the specific test file temporarily
  testMatch: ["<rootDir>/controllers/authController.test.js"],

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
