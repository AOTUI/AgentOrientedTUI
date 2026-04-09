import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@aotui/mobile-ai-native": fileURLToPath(
        new URL("../../mobile-ai-native/src/index.ts", import.meta.url),
      ),
      react: fileURLToPath(
        new URL("../../node_modules/react/index.js", import.meta.url),
      ),
      "react/jsx-runtime": fileURLToPath(
        new URL("../../node_modules/react/jsx-runtime.js", import.meta.url),
      ),
      "react/jsx-dev-runtime": fileURLToPath(
        new URL("../../node_modules/react/jsx-dev-runtime.js", import.meta.url),
      ),
      "react-dom/client": fileURLToPath(
        new URL("./node_modules/react-dom/client.js", import.meta.url),
      ),
      "react-dom": fileURLToPath(
        new URL("./node_modules/react-dom/index.js", import.meta.url),
      ),
    },
  },
});
