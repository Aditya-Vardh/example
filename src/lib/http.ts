import type { ZodType } from "zod";

export type ProviderErrorKind = "timeout" | "network" | "http" | "invalid-response" | "rate-limited";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status?: number;
  readonly provider: string;

  constructor(message: string, options: { kind: ProviderErrorKind; provider: string; status?: number }) {
    super(message);
    this.name = "ProviderError";
    this.kind = options.kind;
    this.provider = options.provider;
    this.status = options.status;
  }
}

export const USER_AGENT = "AETHER-WEATHER/1.0 (weather intelligence dashboard)";

type FetchOptions<T> = {
  schema?: ZodType<T>;
  provider: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  revalidateSeconds?: number;
  signal?: AbortSignal;
  accept?: string;
};

export async function fetchJson<T = unknown>(url: string, options: FetchOptions<T>): Promise<T> {
  const { provider, schema, timeoutMs = 9000, headers, revalidateSeconds, signal, accept } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept ?? "application/json",
        ...headers,
      },
      ...(revalidateSeconds !== undefined ? { next: { revalidate: revalidateSeconds } } : { cache: "no-store" }),
    });

    if (response.status === 429) {
      throw new ProviderError(`${provider} rate limit reached. Try again shortly.`, { kind: "rate-limited", provider, status: 429 });
    }

    if (!response.ok) {
      throw new ProviderError(`${provider} responded with ${response.status}.`, { kind: "http", provider, status: response.status });
    }

    const raw = await response.text();
    let parsed: unknown;
    if (raw.trim().length === 0) {
      if (!schema) {
        throw new ProviderError(`${provider} returned an empty response.`, { kind: "invalid-response", provider });
      }
      const empty = schema.safeParse({});
      if (!empty.success) {
        throw new ProviderError(`${provider} returned an empty response.`, { kind: "invalid-response", provider });
      }
      return empty.data;
    }
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ProviderError(`${provider} returned a response that could not be parsed.`, { kind: "invalid-response", provider });
    }

    if (!schema) return parsed as T;

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderError(`${provider} returned an unexpected response shape.`, { kind: "invalid-response", provider });
    }
    return result.data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (signal?.aborted) throw new ProviderError("Request cancelled.", { kind: "network", provider });
      throw new ProviderError(`${provider} did not respond in time.`, { kind: "timeout", provider });
    }
    throw new ProviderError(`${provider} could not be reached.`, { kind: "network", provider });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export type TextFetchOptions = {
  provider: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  revalidateSeconds?: number;
  signal?: AbortSignal;
};

export async function fetchText(url: string, options: TextFetchOptions): Promise<string> {
  const { provider, timeoutMs = 9000, headers, revalidateSeconds, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,text/plain,*/*", ...headers },
      ...(revalidateSeconds !== undefined ? { next: { revalidate: revalidateSeconds } } : { cache: "no-store" }),
    });
    if (!response.ok) {
      throw new ProviderError(`${provider} responded with ${response.status}.`, { kind: "http", provider, status: response.status });
    }
    return await response.text();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(`${provider} did not respond in time.`, { kind: "timeout", provider });
    }
    throw new ProviderError(`${provider} could not be reached.`, { kind: "network", provider });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function errorStatus(error: unknown): number {
  if (error instanceof ProviderError) {
    if (error.kind === "timeout") return 504;
    if (error.kind === "rate-limited") return 429;
    if (error.status) return 502;
    return 502;
  }
  return 500;
}

type CacheEntry = { expires: number; value: unknown };

const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memoryCache.get(key);
  if (hit && hit.expires > now) return Promise.resolve(hit.value as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = loader()
    .then((value) => {
      memoryCache.set(key, { expires: Date.now() + ttlMs, value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function peekCache<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.value as T;
}
