const nextConfig = {
  experimental: { cpus: 2 },
  outputFileTracingIncludes: {
    "/api/timesheets/export": ["./public/maps-logo.jpeg"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
