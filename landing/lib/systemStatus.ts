"use client";

import * as React from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const STATUS_ENDPOINT = `${API_URL}/api/v1/status`;

// Poll cadence for the footer strip. 60s balances liveness with server load —
// with generalLimiter at 100 req/min/IP, a single tab consumes 1/100th.
const POLL_INTERVAL_MS = 60 * 1000;

export type SystemStatus = {
  cbp: {
    lastPingSecondsAgo: number | null;
    lastPingIso: string | null;
    healthy: boolean;
  };
  addCvd: {
    lastSyncedIso: string | null;
    healthy: boolean;
  };
  openIncidents: number;
  allSystemsOperational: boolean;
  fetchedAtIso: string;
};

/**
 * Fetches the public system-status endpoint on mount and re-polls every 60s.
 * Returns `null` on the initial render (SSR + before first fetch resolves) so
 * consumers can render a stable placeholder without layout shift.
 *
 * Silently swallows errors — a broken /api/v1/status shouldn't crash the
 * footer or render an error state in the marketing shell. Consumers see
 * `null` while the endpoint is unreachable.
 */
export function useSystemStatus(): SystemStatus | null {
  const [status, setStatus] = React.useState<SystemStatus | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch(STATUS_ENDPOINT, { credentials: "omit" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as SystemStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // Intentionally silent — footer degrades gracefully to placeholder.
      } finally {
        if (!cancelled) {
          timer = setTimeout(fetchStatus, POLL_INTERVAL_MS);
        }
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return status;
}

/**
 * Formats a "seconds ago" number into the compact footer form:
 *   `14s ago`, `4m ago`, `2h ago`, `3d ago`.
 * Returns null if the input is null (never-pinged).
 */
export function formatSecondsAgo(sec: number | null): string | null {
  if (sec === null) return null;
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Formats an ISO timestamp into the "HH:MM UTC" form the footer uses for
 * the ADD/CVD sync line. Returns null if the input is null.
 */
export function formatUtcTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}
