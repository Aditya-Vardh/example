"use client";

import { AnimatePresence, motion } from "motion/react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocations } from "@/components/providers/LocationsProvider";
import { placeFromGeocode, placeSubtitle, type Place } from "@/lib/place";
import type { GeocodeResult } from "@/lib/schemas";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

export function SearchBox({
  variant = "sidebar",
  focusSignal = 0,
}: {
  variant?: "sidebar" | "hero" | "capsule";
  focusSignal?: number;
}) {
  const { selectPlace, place } = useLocations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const hero = variant === "hero";
  const capsule = variant === "capsule";

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      setMessage(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");
      setMessage(null);
      fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, headers: { Accept: "application/json" } })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as
            | { results?: GeocodeResult[]; error?: string }
            | null;
          if (!response.ok) throw new Error(body?.error ?? `Search failed with status ${response.status}.`);
          const places = (body?.results ?? []).map((result) => placeFromGeocode(result));
          setResults(places);
          setStatus(places.length ? "ready" : "empty");
          setOpen(true);
          setActive(places.length ? 0 : -1);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setStatus("error");
          setMessage(cause instanceof Error ? cause.message : "Location search is unavailable right now.");
          setOpen(true);
        });
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  const commit = (target: Place) => {
    selectPlace(target);
    setQuery("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter") {
      const target = results[active];
      if (target) {
        event.preventDefault();
        commit(target);
      }
    }
  };

  const showPanel = open && trimmed.length >= 2;
  const panelContent = useMemo(() => {
    if (status === "loading" && !results.length) {
      return (
        <p className="muted flex items-center gap-2 px-3 py-3 text-xs">
          <Loader2 aria-hidden className="anim-spin h-3.5 w-3.5" /> Searching Open-Meteo geocoding…
        </p>
      );
    }
    if (status === "error") {
      return <p className="px-3 py-3 text-xs text-coral">{message}</p>;
    }
    if (status === "empty") {
      return (
        <p className="muted px-3 py-3 text-xs">
          No place matched “{trimmed}”. Try a city name, a region, or add a country.
        </p>
      );
    }
    return null;
  }, [status, results.length, message, trimmed]);

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`flex items-center gap-2.5 transition ${
          capsule
            ? "dock-shell focus-within:border-cyan/45 rounded-full px-4 py-2.5"
            : `focus-within:border-cyan/45 rounded-xl border border-line bg-white/[0.04] ${hero ? "px-3 py-2.5" : "px-3 py-2"}`
        }`}
      >
        <Search aria-hidden className="muted-dim h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search for a city"
          autoComplete="off"
          placeholder={place ? "Search another place…" : "Search a city, region or country"}
          className={`w-full bg-transparent text-sm text-ink outline-none placeholder:text-[rgba(163,171,183,0.75)] ${
            hero ? "py-0.5" : ""
          }`}
        />
        {status === "loading" ? <Loader2 aria-hidden className="anim-spin text-cyan h-3.5 w-3.5" /> : null}
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="focus-ring muted-dim rounded-full p-0.5 transition hover:text-ink"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {showPanel ? (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Location matches"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="scroll-thin absolute top-[calc(100%+10px)] left-0 z-50 max-h-80 w-full overflow-y-auto rounded-[22px] border border-line-hi bg-[rgba(9,10,14,0.97)] p-1.5 shadow-[var(--shadow-float)] backdrop-blur-2xl"
          >
            {panelContent}
            {results.map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(item)}
                  className={`focus-ring flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    index === active ? "bg-cyan/10" : "hover:bg-white/[0.05]"
                  }`}
                >
                  <MapPin aria-hidden className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${index === active ? "text-cyan" : "muted-dim"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{item.name}</span>
                    <span className="muted-dim block truncate text-[11px]">
                      {placeSubtitle(item) || `${item.latitude.toFixed(2)}, ${item.longitude.toFixed(2)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
