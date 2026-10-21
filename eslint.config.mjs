import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import babelParser from "@babel/eslint-parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// typescript-eslint does not support TypeScript 7 yet, which this repo typechecks with.
// Babel parses TypeScript so jsx-a11y can still fail the build.
// When typescript-eslint supports TypeScript 7, replace this parser. See CLAUDE.md.
// Do not downgrade TypeScript.
export default [
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/coverage/**", "next-env.d.ts"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [["@babel/preset-react", { runtime: "automatic" }], "@babel/preset-typescript"],
        },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Type-only imports look unused to a non-type-aware parser.
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    // The scripts are plain JavaScript that Node runs, so they need the Node globals.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/anchor-is-valid": "off",
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    settings: {
      next: {
        rootDir: "./",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
  eslintConfigPrettier,
];
