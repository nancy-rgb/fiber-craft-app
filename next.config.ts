import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { OFFLINE_SHELL_ID } from "./lib/offlineShell";

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    "/",
    "/garments/new",
    "/amigurumi/new",
    "/colorwork/new",
    "/hats/new",
    `/project/${OFFLINE_SHELL_ID}`,
    "/manifest.webmanifest",
  ].map((url) => ({ url, revision })),
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
