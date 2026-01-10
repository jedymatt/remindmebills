import { NextResponse, type NextRequest } from "next/server";
import { auth } from "./server/auth";
import { headers } from "next/headers";

// https://www.better-auth.com/docs/integrations/next#nextjs-16-proxy
export default async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard"], // Specify the routes the middleware applies to
};
