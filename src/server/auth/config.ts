import type { BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { anonymous, oAuthProxy } from "better-auth/plugins";
import { env } from "~/env";
import { db } from "~/server/db";

export const authConfig = {
  database: mongodbAdapter(db),
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "www.remindmebills.com",
      "remindmebills.com",
      "remindmebills.vercel.app",
      "remindmebills-*-jedymatt-personal.vercel.app",
    ],
    protocol: env.NODE_ENV === "development" ? "http" : "https",
  },
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      redirectURI: "https//www.remindmebills.com",
    },
  },
  plugins: [
    nextCookies(),
    anonymous(),
    oAuthProxy({
      productionURL: "https://www.remindmebills.com"
    }),
  ],
  account: {
    modelName: "accounts",
  },
  session: {
    modelName: "sessions",
  },
  user: {
    modelName: "users",
  },
  verification: {
    modelName: "verifications",
  },
} satisfies BetterAuthOptions;
