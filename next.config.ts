import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next injects a managed block into AGENTS.md on every `next dev`.
  // AGENTS.md is our chassis contract and must stay exactly as committed.
  agentRules: false,
};

export default nextConfig;
