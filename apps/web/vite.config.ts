import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@rundown/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    // Needed for phone testing over LAN/ngrok; HTTPS is handled by ngrok in front of this.
    host: true,
    allowedHosts: true, // allow ngrok tunnel hosts for phone testing
    proxy: {
      // Google's Directions/Elevation REST endpoints send no CORS headers.
      // Dev-only shim; production routes these through an Edge Function with
      // a server-side key so the browser key is never used for billable REST.
      "/maps-api": {
        target: "https://maps.googleapis.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/maps-api/, ""),
      },
      // Routes API (Compute Routes) lives on a different host; the Maps Demo
      // Key supports it (legacy Directions it does NOT).
      "/routes-api": {
        target: "https://routes.googleapis.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/routes-api/, ""),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "RUNDOWN",
        short_name: "RUNDOWN",
        description: "Real-world AR pursuit — hunt the Rungent.",
        theme_color: "#07090C",
        background_color: "#07090C",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
