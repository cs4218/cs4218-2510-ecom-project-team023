import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // 🔹 Base config for JS/TS/React source files
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // 🔹 Add Jest environment only for test files
  {
    files: ["**/*.test.{js,ts,jsx,tsx}", "**/__tests__/**/*.{js,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest, // 👈 adds test, describe, expect, beforeEach, etc.
      },
    },
  },

  // 🔹 TypeScript + React recommended configs
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
]);
