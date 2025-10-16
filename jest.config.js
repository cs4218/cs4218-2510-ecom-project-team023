export default {
  projects: [
    // ---------- Backend ----------
    {
      displayName: "backend",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/controllers/**/*.test.js",
        "<rootDir>/models/**/*.test.js",
        "<rootDir>/routes/**/*.test.js",
        "<rootDir>/helpers/**/*.test.js",
        "<rootDir>/middlewares/**/*.test.js",
      ],
      testPathIgnorePatterns: ["/node_modules/", "<rootDir>/client/"],
      collectCoverage: true,
      collectCoverageFrom: [
        "controllers/**/*.js",
        "routes/**/*.js",
        "helpers/**/*.js",
        "middlewares/**/*.js",
        "models/**/*.js",
        "!**/*.test.js",
      ],
      coverageReporters: ["lcov", "text-summary"],
      coverageDirectory: "<rootDir>/server/coverage",
    },

    // ---------- Frontend ----------
    {
      displayName: "frontend",
      testEnvironment: "jest-environment-jsdom",
      testMatch: ["<rootDir>/client/src/**/*.test.[jt]s?(x)"],
      setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
      transform: {
        "^.+\\.[jt]sx?$": "babel-jest",
      },
      moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
      collectCoverage: true,
      collectCoverageFrom: [
        "client/src/**",
        "!client/src/**/*.test.[jt]s?(x)",
        "!client/src/index.*",
        "!client/src/reportWebVitals.*",
        "!client/src/main.*",
      ],
      coverageReporters: ["lcov", "text-summary"],
      coverageDirectory: "<rootDir>/client/coverage",
    },
  ],
};
