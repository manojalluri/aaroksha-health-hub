import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: true,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "logo.png", "robots.txt"],
        manifest: {
          name: "Aaroksha Health Hub",
          short_name: "Aaroksha",
          description: "Bhimavaram's First Integrated Digital Healthcare Platform — Order Medicines, Book Lab Tests & Doctor Appointments",
          theme_color: "#1d4ed8",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          lang: "en",
          categories: ["health", "medical", "lifestyle"],
          icons: [
            {
              src: "/favicon.png",
              sizes: "72x72",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "96x96",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "128x128",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "144x144",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "152x152",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/favicon.png",
              sizes: "384x384",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          shortcuts: [
            {
              name: "Book Lab Test",
              short_name: "Lab Tests",
              description: "Book a lab test with home sample collection",
              url: "/lab-tests",
              icons: [{ src: "/favicon.png", sizes: "192x192" }]
            },
            {
              name: "Order Medicines",
              short_name: "Medicines",
              description: "Order medicines with fast delivery",
              url: "/medicines",
              icons: [{ src: "/favicon.png", sizes: "192x192" }]
            },
            {
              name: "Book Doctor",
              short_name: "Doctors",
              description: "Book an appointment with a doctor",
              url: "/doctors",
              icons: [{ src: "/favicon.png", sizes: "192x192" }]
            }
          ],
          screenshots: [
            {
              src: "/favicon.png",
              sizes: "512x512",
              type: "image/png",
              form_factor: "narrow",
              label: "Aaroksha Health Hub Home"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/admin/, /^\/api/],
          runtimeCaching: [
            {
              // Supabase API — network first, fall back to cache
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5 // 5 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Google Fonts
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Images
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            },
            {
              // JS/CSS static assets
              urlPattern: /\.(?:js|css)$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-assets-cache",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: false // only active in production build
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'sonner'],
            data: ['@supabase/supabase-js', '@tanstack/react-query']
          }
        }
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
