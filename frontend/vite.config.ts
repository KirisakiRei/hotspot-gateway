import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Map — chunk terbesar, isolasi sendiri
          if (id.includes("leaflet") || id.includes("react-leaflet")) return "map";
          // Animation
          if (id.includes("framer-motion")) return "animation";
          // Charts
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          // Network
          if (id.includes("socket.io-client") || id.includes("engine.io")) return "socket";
          if (id.includes("axios")) return "http";
          // Semua sisanya (react, router, radix, dll) → satu vendor chunk
          // Ini mencegah circular dependency antar React/router/radix
          return "vendor";
        },
      },
    },
  },
}));
