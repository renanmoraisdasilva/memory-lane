import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "release/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "ui-mockups/**",
      "docs/**",
      "scripts/**",
      "*.config.*",
      ".dependency-cruiser.cjs",
      "eslint.config.mjs",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      sonarjs,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "react/jsx-key": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/main/**/*.ts", "src/preload/**/*.ts", "src/shared/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["tests/**/*.ts", "**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/unbound-method": "off",
      "max-lines-per-function": "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  prettier,
);
