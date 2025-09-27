// jest.config.js (root)
export default {
  projects: [
    // ---------- Backend ----------
    {
      displayName: "backend",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/controllers/**/*.test.js",
        "<rootDir>/models/**/*.test.js",
      ],
      testPathIgnorePatterns: ["/node_modules/", "<rootDir>/client/"],
    },

    // ---------- Frontend ----------
    {
      displayName: "frontend",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/client/src/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/client/jest.setup.js"],
      transform: {
        "^.+\\.[jt]sx?$": "babel-jest",
      },
      moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
    },
  ],
};
