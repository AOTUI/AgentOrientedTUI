import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@aotui/mobile-ai-native": fileURLToPath(
        new URL("../../mobile-ai-native/dist/index.js", import.meta.url),
      ),
      "@aotui/mobile-ai-native-react-native": fileURLToPath(
        new URL(
          "../../packages/mobile-ai-native-react-native/dist/index.js",
          import.meta.url,
        ),
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
    },
  },
});
