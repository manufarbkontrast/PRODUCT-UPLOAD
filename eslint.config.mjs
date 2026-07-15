import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archivierter, unreferenzierter Deadcode — nicht Teil der App, nicht linten.
    "_archive/**",
  ]),
  {
    // Test-Mocks dürfen `any` nutzen (partielle Fremdtypen wie SupabaseClient
    // vollständig nachzubauen bringt keinen Testwert).
    files: ["**/*.test.ts", "**/*.test.tsx", "__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
