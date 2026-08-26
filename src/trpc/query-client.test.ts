import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { shouldRetryQuery } from "~/trpc/query-client";

/**
 * Builds the error a failed procedure actually hands React Query: a real
 * `TRPCClientError` carrying the server's error shape, not a hand-rolled
 * stand-in. `httpStatus` is what the predicate reads, so a fake object with the
 * right keys would pass while proving nothing about the real error class.
 */
function trpcError(code: string, httpStatus: number) {
  return TRPCClientError.from({
    error: {
      message: code,
      code: -32600,
      data: { code, httpStatus, path: "bill.getById" },
    },
  });
}

describe("shouldRetryQuery", () => {
  it("does not retry a bill that no longer exists", () => {
    expect(shouldRetryQuery(0, trpcError("NOT_FOUND", 404))).toBe(false);
  });

  it("does not retry when the caller is not allowed", () => {
    expect(shouldRetryQuery(0, trpcError("UNAUTHORIZED", 401))).toBe(false);
    expect(shouldRetryQuery(0, trpcError("FORBIDDEN", 403))).toBe(false);
  });

  it("does not retry any other client error", () => {
    expect(shouldRetryQuery(0, trpcError("BAD_REQUEST", 400))).toBe(false);
    expect(shouldRetryQuery(0, trpcError("CONFLICT", 409))).toBe(false);
  });

  it("retries a timeout or a rate limit, which do clear on their own", () => {
    expect(shouldRetryQuery(0, trpcError("TIMEOUT", 408))).toBe(true);
    expect(shouldRetryQuery(0, trpcError("TOO_MANY_REQUESTS", 429))).toBe(true);
  });

  it("retries a server error", () => {
    expect(shouldRetryQuery(0, trpcError("INTERNAL_SERVER_ERROR", 500))).toBe(
      true,
    );
  });

  it("retries a bare network failure, which carries no error shape", () => {
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
  });

  it("still gives up after three attempts", () => {
    const offline = new TypeError("Failed to fetch");
    expect(shouldRetryQuery(2, offline)).toBe(true);
    expect(shouldRetryQuery(3, offline)).toBe(false);
  });

  it("gives up on a client error immediately, not after the third attempt", () => {
    // The bug this guards: a NOT_FOUND used to cost four requests and ~7s of
    // backoff before surfacing, because the count was the only thing consulted.
    expect(shouldRetryQuery(0, trpcError("NOT_FOUND", 404))).toBe(false);
  });
});
