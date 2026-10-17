import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync } from "node:fs";

// libarchive's worker locates its verified WASM next to the worker bundle.
function archiveAssets() {
  const copy = () => {
    mkdirSync("public/libarchive", { recursive: true });
    for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
      mkdirSync(`public/pdfjs/${dir}`, { recursive: true });
      cpSync(`node_modules/pdfjs-dist/${dir}`, `public/pdfjs/${dir}`, {
        recursive: true,
      });
    }
    for (const name of ["worker-bundle.js", "libarchive.wasm"]) {
      cpSync(
        `node_modules/libarchive.js/dist/${name}`,
        `public/libarchive/${name}`,
      );
    }
  };
  return {
    name: "local-archive-assets",
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  base: "./",
  optimizeDeps: {
    include: ["foliate-js/mobi.js", "fflate", "pdfjs-dist", "libarchive.js"],
  },
  plugins: [react(), archiveAssets()],
  server: { port: 5173 },
});
