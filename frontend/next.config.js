/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "trail-jerseys-bucket.s3.ap-south-1.amazonaws.com",
        port: "",
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
    ],
  },
};

module.exports = nextConfig;
