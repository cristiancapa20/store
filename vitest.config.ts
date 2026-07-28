import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/**/actions.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Fuera del runtime react-server, `server-only` lanza al importarse; en
      // pruebas se resuelve al modulo vacio que el propio paquete publica.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
