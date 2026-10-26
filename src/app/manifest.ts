import type { MetadataRoute } from "next";

// Staff install the app from the browser ("Add to Home Screen"); guests never need to.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "resto — для персонала",
    short_name: "resto",
    start_url: "/go",
    scope: "/",
    display: "standalone",
    background_color: "#0F1012",
    theme_color: "#0F1012",
    lang: "ru",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
