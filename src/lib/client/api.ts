"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

/** Tiny data hook: load on mount, refresh on demand, optional polling. */
export function useApi<T>(url: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const d = await api<T>(u);
      if (urlRef.current === u) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(!!url);
    void load();
    if (!opts.poll || !url) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, opts.poll);
    return () => clearInterval(t);
  }, [url, opts.poll, load]);

  return { data, error, loading, reload: load, setData };
}

export function timeAgo(iso: string | Date) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600_000);
  const m = Math.floor((abs % 3600_000) / 60_000);
  const txt = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
  return { overdue: ms < 0, text: ms < 0 ? `${txt} over` : `${txt} left` };
}
