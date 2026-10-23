import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, target: "es2020" },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4310",
      "/provider/api": "http://127.0.0.1:4310",
    },
  },
});
