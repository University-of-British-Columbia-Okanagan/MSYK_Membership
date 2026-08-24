import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  plugins: [reactRouter(), tsconfigPaths()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
      "@": path.resolve(__dirname, "./app"),
    },
  },
  // Vite's default dep scan only follows what the entry HTML reaches, so deps
  // used exclusively by not-yet-visited routes get discovered mid-session —
  // Vite then re-bundles and force-reloads, which surfaces as a spurious
  // "Invalid hook call / more than one copy of React" error in the console.
  // Scanning every route up front finds them in one pass instead.
  optimizeDeps: {
    entries: ["app/**/*.{ts,tsx}"],
  },
});
