/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Agent-commerce discovery at the conventional well-known path.
      { source: "/.well-known/agent-commerce", destination: "/api/agent-commerce" },
    ];
  },
};

module.exports = nextConfig;
