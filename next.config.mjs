/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ảnh listing hiện là placeholder local; khi nối OneDrive→Storage thì thêm remotePatterns
  images: { unoptimized: true },
};

export default nextConfig;
