"use client";

import { AlertTriangle, CloudOff, Info, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { relativeFromNow } from "@/lib/time";

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton rounded-sm ${className}`} />;
}

export function CardSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`rounded-[26px] border border-line/60 p-5 sm:p-7 ${className}`}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-10 w-44" />
      <div className="mt-6 grid gap-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full opacity-70" />
        ))}
      </div>
    </div>
  );
}

export function InlineSpinner({ className = "" }: { className?: string }) {
  return <Loader2 aria-hidden className={`anim-spin h-3.5 w-3.5 ${className}`} />;
}

export function ErrorState({
  title = "Data unavailable",
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`border-l-2 border-coral/70 bg-[linear-gradient(90deg,rgba(240,149,143,0.1),transparent_72%)] ${
        compact ? "px-3 py-2.5" : "px-4 py-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-[2px] h-4 w-4 shrink-0 text-coral" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          <p className="muted mt-1 text-[11.5px] leading-relaxed break-words">{message}</p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-coral/45 px-3 py-1.5 text-[11px] font-semibold text-coral transition hover:bg-coral/15"
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function UnavailableState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 border-y border-line px-4 py-10 text-center">
      <span className="muted-dim">{icon ?? <CloudOff aria-hidden className="h-5 w-5" />}</span>
      <p className="text-[13px] font-semibold text-ink-soft">{title}</p>
      <p className="muted max-w-[52ch] text-[11.5px] leading-relaxed">{message}</p>
    </div>
  );
}

export function OfflineNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 border-l-2 border-amber/70 bg-[linear-gradient(90deg,rgba(232,197,131,0.1),transparent_72%)] px-4 py-2.5 text-[11.5px] text-amber">
      <WifiOff aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">You appear to be offline. Showing the last successful response.</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring rounded-full border border-amber/45 px-2.5 py-1 font-semibold"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function DataStamp({
  lastUpdated,
  stale,
  refreshing,
  staleLabel = "This reading is older than expected.",
}: {
  lastUpdated: number | null;
  stale?: boolean;
  refreshing?: boolean;
  staleLabel?: string;
}) {
  return (
    <div className="muted flex flex-wrap items-center gap-2 text-[11px]">
      {refreshing ? (
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <InlineSpinner /> Updating
        </span>
      ) : null}
      <span className="tnum">
        {lastUpdated ? `Updated ${relativeFromNow(lastUpdated)}` : "Awaiting first response"}
      </span>
      {stale ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber/35 bg-amber/10 px-2 py-[2px] font-semibold text-amber">
          <Info aria-hidden className="h-3 w-3" /> {staleLabel}
        </span>
      ) : null}
    </div>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="muted-dim mt-4 text-[10.5px] leading-relaxed">{children}</p>;
}
