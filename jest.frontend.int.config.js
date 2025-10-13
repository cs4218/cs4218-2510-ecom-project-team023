// client/jest.frontend.int.config.cjs
const path = require("path");

module.exports = {
  // Jest will treat the client folder as the root for this config
  rootDir: __dirname, // .../client
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/client/src/**/*.int.test.js"],
  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  // polyfills file is at repo root; adjust if yours is elsewhere
  setupFiles: ["<rootDir>/jest.polyfills.cjs"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
};
