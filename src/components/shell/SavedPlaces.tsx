"use client";

import { Bookmark, MapPin, Trash2 } from "lucide-react";
import { useLocations } from "@/components/providers/LocationsProvider";
import { Popover } from "@/components/ui/Popover";
import { placeLabel, placeSubtitle } from "@/lib/place";

export function SavedPlaces({ compact = false }: { compact?: boolean }) {
  const { saved, place, selectPlace, removePlace } = useLocations();

  return (
    <Popover
      label="Saved"
      title="Saved locations"
      icon={<Bookmark aria-hidden className="h-4 w-4" />}
      badge={saved.length}
      compact={compact}
    >
      <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-soft uppercase">Saved locations</p>
      {saved.length === 0 ? (
        <div className="mt-3 rounded-xl border border-line bg-white/[0.02] px-3 py-4">
          <p className="text-xs font-semibold text-ink-soft">No saved locations yet</p>
          <p className="muted-dim mt-1 text-[11px] leading-relaxed">
            Search for a city and use the bookmark control in the location header to keep it here for one-click switching.
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {saved.map((item) => {
            const active = place?.id === item.id;
            return (
              <li key={item.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => selectPlace(item)}
                  aria-current={active ? "true" : undefined}
                  className={`focus-ring flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                    active ? "bg-cyan/12 text-ink" : "hover:bg-white/[0.05]"
                  }`}
                >
                  <MapPin aria-hidden className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${active ? "text-cyan" : "muted-dim"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{item.name}</span>
                    <span className="muted-dim block truncate text-[11px]">{placeSubtitle(item) || placeLabel(item)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name} from saved locations`}
                  onClick={() => removePlace(item.id)}
                  className="focus-ring muted-dim grid w-8 shrink-0 place-items-center rounded-lg border border-transparent transition hover:border-coral/35 hover:text-coral"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted-dim mt-3 text-[10.5px] leading-relaxed">
        Saved locations are stored in this browser with localStorage and never leave your device.
      </p>
    </Popover>
  );
}
