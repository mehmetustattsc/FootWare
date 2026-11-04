import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the build works at the domain root,
// under a sub-path (e.g. ttscbuchen.de/footware/) and inside an iframe.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
