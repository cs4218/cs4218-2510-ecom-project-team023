export default {
  // name displayed during tests
  displayName: "frontend",

  // simulates browser environment in jest
  // e.g., using document.querySelector in your tests
  testEnvironment: "jest-environment-jsdom",

  // jest does not recognise jsx files by default, so we use babel to transform any jsx files
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },

  // tells jest how to handle css/scss imports in your tests
  moduleNameMapper: {
    "\\.(css|scss)$": "identity-obj-proxy",
  },

  // ignore all node_modules except styleMock (needed for css imports)
  transformIgnorePatterns: ["/node_modules/(?!(styleMock\\.js)$)"],

  // run all test files ending with .test.js or .test.jsx or .test.ts/tsx inside client/src
  // testMatch: ["<rootDir>/client/src/!(_*)/**/*.test.[jt]s?(x)"],
  testMatch: ["<rootDir>/client/src/pages/admin/AdminOrders.test.js"],

  // jest code coverage
  collectCoverage: true,
  collectCoverageFrom: ["client/src/!(_*)/**", "!client/src/**/*.test.js"],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
};
