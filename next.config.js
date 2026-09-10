/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

console.log("PROBE_BETTER_AUTH_URL=" + process.env.BETTER_AUTH_URL);

/** @type {import("next").NextConfig} */
const config = {};

export default config;
