import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "tailwindcss"
import { defineConfig } from "vite"
import slang from "./src/vite-plugin-slang"
 
export default defineConfig({
  plugins: [react(), slang()],
  worker: {
    plugins: () => [slang()],
  },
  base: "/webgpu-slang-pathtracer/",
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})