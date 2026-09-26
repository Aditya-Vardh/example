"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocumentVisible } from "@/lib/appearance";

export type AsyncDataState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  lastUpdated: number | null;
  refresh: () => void;
};

type Options = {
  enabled?: boolean;
  intervalMs?: number;
  staleAfterMs?: number;
};

export async function fetchTyped<T>(url: string, signal: AbortSignal): Promise<{ payload: T; fetchedAt: number }> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    throw new Error("The server returned a response that could not be read.");
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  const fetchedAt =
    body && typeof body === "object" && "fetchedAt" in body && typeof (body as { fetchedAt: unknown }).fetchedAt === "number"
      ? (body as { fetchedAt: number }).fetchedAt
      : Date.now();
  return { payload: body as T, fetchedAt };
}

export function useAsyncData<T>(url: string | null, options: Options = {}): AsyncDataState<T> {
  const { enabled = true, intervalMs, staleAfterMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url && enabled));
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const visible = useDocumentVisible();

  const controllerRef = useRef<AbortController | null>(null);
  const dataRef = useRef<T | null>(null);
  const hasLoadedRef = useRef(false);
  const resourceRef = useRef<string | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!url || !enabled) {
      return;
    }
    if (resourceRef.current !== url) {
      resourceRef.current = url;
      hasLoadedRef.current = false;
      dataRef.current = null;
      setData(null);
      setLastUpdated(null);
      setError(null);
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const firstLoad = !hasLoadedRef.current;
    if (firstLoad) setLoading(true);
    else setRefreshing(true);

    fetchTyped<T>(url, controller.signal)
      .then(({ payload, fetchedAt }) => {
        setData(payload);
        setLastUpdated(fetchedAt);
        setError(null);
        hasLoadedRef.current = true;
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Something went wrong while loading data.");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
  }, [url, enabled, tick]);

  useEffect(() => {
    if (!intervalMs || !enabled || !visible) return;
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled, visible]);

  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!staleAfterMs || !lastUpdated) {
      setStale(false);
      return;
    }
    const evaluate = () => setStale(Date.now() - lastUpdated > staleAfterMs);
    evaluate();
    const id = window.setInterval(evaluate, 30000);
    return () => window.clearInterval(id);
  }, [lastUpdated, staleAfterMs, visible]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return {
    data,
    error,
    loading: loading && !dataRef.current,
    refreshing,
    stale,
    lastUpdated,
    refresh,
  };
}
