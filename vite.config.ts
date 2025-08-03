import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  base: '/',
  build: {
    assetsInlineLimit: 0,
  },
  ssr: {
    noExternal: ['tesseract.js'], // ✅ prevent SSR errors from dynamic require
  },
  optimizeDeps: {
    include: ['tesseract.js'], // ✅ pre-bundle for faster dev
  }
});
