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
          // Charts
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          // Realtime / network
          if (id.includes("socket.io-client") || id.includes("engine.io")) return "socket";
          if (id.includes("axios")) return "http";
          // Icons (tree-shakeable tapi tetap pisahkan)
          if (id.includes("lucide-react")) return "icons";
          // Animation — framer-motion cukup besar (~100 kB gz)
          if (id.includes("framer-motion")) return "animation";
          // Map — leaflet + react-leaflet + react-leaflet-cluster
          if (
            id.includes("leaflet") ||
            id.includes("react-leaflet")
          ) return "map";
          // React core
          if (id.includes("react-dom") || id.includes("/react/")) return "react";
          // Router
          if (id.includes("react-router")) return "router";
          // Radix UI primitives
          if (id.includes("@radix-ui")) return "radix";
          // Form & validation
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "forms";
          // Remaining vendor
          return "vendor";
        },
      },
    },
  },
}));
