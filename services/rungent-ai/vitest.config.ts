import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@rundown/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
