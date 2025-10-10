import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@bratgen/ui", "@bratgen/analysis", "@bratgen/ffmpeg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" }
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/app": path.resolve(__dirname, "./app"),
      "@/components": path.resolve(__dirname, "./app/components"),
      "@/lib": path.resolve(__dirname, "./app/lib"),
      "fluent-ffmpeg$": require.resolve("fluent-ffmpeg/lib/fluent-ffmpeg"),
    };
    return config;
  }
};

export default nextConfig;
