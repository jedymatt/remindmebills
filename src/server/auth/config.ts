import type { BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { anonymous, oAuthProxy } from "better-auth/plugins";
import { env } from "~/env";
import { db } from "~/server/db";

export const authConfig = {
  database: mongodbAdapter(db),
  dynamicBaseUrl: !env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:3000",
    "https://www.remindmebills.com",
    "https://remindmebills.com",
    "https://remindmebills.vercel.app",
    "https://remindmebills-*-jedymatt-personal.vercel.app",
  ],
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
      productionURL: "https://www.remindmebills.com",
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
