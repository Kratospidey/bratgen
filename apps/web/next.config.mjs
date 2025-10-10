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
  }
};

export default nextConfig;
