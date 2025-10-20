// jest.backend.config.js
export default {
  displayName: "backend",
  rootDir: ".",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/controllers/**/*.test.js",
    "<rootDir>/models/**/*.test.js",
    "<rootDir>/routes/**/*.test.js",
    "<rootDir>/helpers/**/*.test.js",
    "<rootDir>/middlewares/**/*.test.js",
  ],
    testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/client/",
    "<rootDir>/docs/",
    "<rootDir>/public/",
    "<rootDir>/build/",
    "<rootDir>/dist/"
  ],  

  collectCoverage: true,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "routes/**/*.js",
    "helpers/**/*.js",
    "middlewares/**/*.js",
    "models/**/*.js",
    "!**/*.test.js",
  ],

  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/client/",
    "<rootDir>/docs/",
    "<rootDir>/public/",
    "<rootDir>/build/",
    "<rootDir>/dist/"
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageThreshold: { global: { lines: 90, functions: 90 } },
};
