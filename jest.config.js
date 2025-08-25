// jest.config.js  (root)
export default {
  // Run each sub‑project with its own config / displayName
  projects: [
    "<rootDir>/jest.backend.config.js",
    "<rootDir>/jest.frontend.config.js"
  ]
};
