import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/api/root";

const MAX_ATTEMPTS = 3;

const CLIENT_ERROR_FIRST_STATUS = 400;
const SERVER_ERROR_FIRST_STATUS = 500;

// A client error is the server saying "this request is wrong", which no amount
// of repeating will fix -- except these two, which say "wrong *for now*".
const RETRYABLE_CLIENT_STATUSES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
]);

/**
 * Retries only failures that a later attempt could plausibly resolve.
 *
 * Without this, the query default of three retries applies to 4xx responses
 * too, so a NOT_FOUND costs four requests and ~7s of backoff before it ever
 * reaches the UI. Errors with no tRPC shape -- a dropped connection, DNS
 * failure -- are exactly what retrying is for, so they keep the default.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (isUnretryableClientError(error)) return false;
  return failureCount < MAX_ATTEMPTS;
}

function isUnretryableClientError(error: unknown): boolean {
  if (!isTRPCClientError<AppRouter>(error)) return false;

  const status = error.data?.httpStatus;
  if (status === undefined) return false;
  if (RETRYABLE_CLIENT_STATUSES.has(status)) return false;

  return (
    status >= CLIENT_ERROR_FIRST_STATUS && status < SERVER_ERROR_FIRST_STATUS
  );
}

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        retry: shouldRetryQuery,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
