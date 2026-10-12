import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Sandbox-only: proxy API calls through the dev server so the browser makes
// same-origin requests (the remote API only allows CORS from its production
// web origin). Also allow the preview origin for dev assets/HMR.
if (process.env.BASE44_PREVIEW_MODE === "1") {
  const apiTarget = (process.env.API_PROXY_TARGET ?? "https://wt-api.flozy.app").replace(/\/$/, "");
  nextConfig.rewrites = async () => [
    { source: "/v1/:path*", destination: `${apiTarget}/v1/:path*` },
  ];
  const previewOrigin = `https://3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX ?? ""}`;
  if (process.env.BASE44_PUBLIC_HOST_SUFFIX) {
    nextConfig.allowedDevOrigins = [...(nextConfig.allowedDevOrigins ?? []), previewOrigin];
  }
}

export default nextConfig;
