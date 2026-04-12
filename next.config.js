/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

const nextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
};

export default nextConfig;
