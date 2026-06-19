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
      "remindmebills.com",
      "remindmebills.vercel.app",
      "remindmebills-*-jedymatt-personal.vercel.app/",
      "localhost:3000",
    ],
    protocol: env.NODE_ENV === "development" ? "http" : "https",
  },
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    },
  },
  plugins: [
    nextCookies(),
    anonymous(),
    oAuthProxy({
      productionURL: "https://remindmebills.com",
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
