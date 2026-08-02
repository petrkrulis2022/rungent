import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@rundown/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
} as any);
