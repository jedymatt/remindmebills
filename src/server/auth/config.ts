import type { BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env } from "~/env";
import { db as client } from "~/server/db";

const authDb = client.db("main");

export const authConfig = {
  database: mongodbAdapter(authDb),
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    },
  },
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
