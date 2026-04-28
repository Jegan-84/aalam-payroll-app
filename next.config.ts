import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-zklib is a CommonJS package that opens UDP sockets via `dgram`.
  // Bundling it through webpack breaks the `module.exports = ZKLib` shape
  // and the dynamic socket lifecycle. Keep it external so it loads via the
  // raw Node require at runtime.
  serverExternalPackages: ['node-zklib'],
};

export default nextConfig;
