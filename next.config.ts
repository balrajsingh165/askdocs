import type { NextConfig } from "next";

/**
 * Native and heavy Node-only packages must be treated as external server
 * packages so Turbopack does not attempt to bundle them:
 * - `better-sqlite3` ships a native `.node` binary.
 * - `@xenova/transformers` loads the ONNX runtime and model weights at runtime.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers"],
};

export default nextConfig;
