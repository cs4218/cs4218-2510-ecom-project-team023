// jest.frontend.config.js (ESM)
export default {
  displayName: "frontend",
  testEnvironment: "jest-environment-jsdom",

  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  moduleNameMapper: { "\\.(css|less|scss|sass)$": "identity-obj-proxy" },

  // ✅ Only look for tests in your React app, not generated site
  testMatch: ["<rootDir>/client/src/**/*.test.[jt]s?(x)"],
  setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],

  // ✅ Only instrument real app source; exclude tests & generated/built folders
  collectCoverage: true,
  collectCoverageFrom: [
    "client/src/**/*.{js,jsx,ts,tsx}",
    "!client/src/**/*.test.[jt]s?(x)",
    "!client/src/**/__tests__/**",
    "!client/src/**/*.d.ts",
    "!client/src/**/__generated__/**",
    "!client/src/**/*.stories.[jt]sx?",
    "!client/src/index.*",
    "!client/src/main.*",
    "!client/src/reportWebVitals.*",

    // 🚫 EXCLUDE the generated MarkBind site output
    "!client/src/_site/**"
  ],

  // Don’t traverse these for tests
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/client/public/",
    "<rootDir>/client/build/",
    "<rootDir>/client/dist/",
    "<rootDir>/client/out/",
    "<rootDir>/client/.next/",
    "<rootDir>/client/.markbind/",
    "<rootDir>/client/docs/",
    "<rootDir>/client/src/_site/",   // ⬅️ important
    "<rootDir>/docs/",
    "<rootDir>/public/",
    "<rootDir>/build/",
    "<rootDir>/dist/"
  ],

  // Don’t include these in coverage denominator either
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/client/public/",
    "<rootDir>/client/build/",
    "<rootDir>/client/dist/",
    "<rootDir>/client/out/",
    "<rootDir>/client/.next/",
    "<rootDir>/client/.markbind/",
    "<rootDir>/client/docs/",
    "<rootDir>/client/src/_site/",   // ⬅️ important
    "<rootDir>/docs/",
    "<rootDir>/public/",
    "<rootDir>/build/",
    "<rootDir>/dist/",
    "<rootDir>/client/coverage/"
  ],

  coverageReporters: ["lcov", "text-summary"],
  coverageDirectory: "<rootDir>/client/coverage"
};
