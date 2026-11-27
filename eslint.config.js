import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
    rules: { "no-unused-vars": "off" },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: { sourceType: "module", globals: globals.node },
  },
];
