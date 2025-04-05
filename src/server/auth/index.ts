import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { authConfig } from "./config";

const auth = betterAuth(authConfig);
const handlers = toNextJsHandler(auth);

export { auth, handlers };
