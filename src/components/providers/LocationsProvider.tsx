"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { placeFromCoordinates, type Place } from "@/lib/place";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

export type LocationStatus = "idle" | "locating" | "success" | "denied" | "unavailable" | "timeout" | "error";

type LocationsContextValue = {
  place: Place | null;
  saved: Place[];
  hydrated: boolean;
  locationStatus: LocationStatus;
  locationError: string | null;
  selectPlace: (place: Place) => void;
  savePlace: (place: Place) => void;
  removePlace: (id: string) => void;
  toggleSaved: (place: Place) => void;
  isSaved: (id: string) => boolean;
  clearPlace: () => void;
  clearLocationError: () => void;
  requestMyLocation: () => void;
};

const LocationsContext = createContext<LocationsContextValue | null>(null);

type StoredPlace = Omit<Place, "source" | "addedAt"> & { source?: Place["source"]; addedAt?: number };

function revivePlace(stored: StoredPlace | null): Place | null {
  if (!stored || typeof stored.latitude !== "number" || typeof stored.longitude !== "number" || !stored.name) return null;
  return { ...stored, source: stored.source ?? "search", addedAt: stored.addedAt ?? Date.now() };
}

export function LocationsProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<Place | null>(null);
  const [saved, setSaved] = useState<Place[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const storedPlace = revivePlace(readStorage<StoredPlace | null>(STORAGE_KEYS.place, null));
    const storedSaved = readStorage<StoredPlace[]>(STORAGE_KEYS.saved, [])
      .map((item) => revivePlace(item))
      .filter((item): item is Place => item !== null);
    if (storedPlace) setPlace(storedPlace);
    setSaved(storedSaved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (place) writeStorage(STORAGE_KEYS.place, place);
  }, [place, hydrated]);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.saved, saved);
  }, [saved, hydrated]);

  const selectPlace = useCallback((next: Place) => {
    setPlace(next);
    setLocationStatus("idle");
    setLocationError(null);
  }, []);

  const savePlace = useCallback((next: Place) => {
    setSaved((current) => (current.some((item) => item.id === next.id) ? current : [next, ...current].slice(0, 12)));
  }, []);

  const removePlace = useCallback((id: string) => {
    setSaved((current) => current.filter((item) => item.id !== id));
  }, []);

  const isSaved = useCallback((id: string) => saved.some((item) => item.id === id), [saved]);

  const toggleSaved = useCallback(
    (next: Place) => {
      setSaved((current) => {
        if (current.some((item) => item.id === next.id)) return current.filter((item) => item.id !== next.id);
        return [next, ...current].slice(0, 12);
      });
    },
    []
  );

  const clearPlace = useCallback(() => {
    setPlace(null);
    setLocationStatus("idle");
    setLocationError(null);
  }, []);

  const requestMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationError("This browser does not expose the geolocation API. Search for a city instead.");
      return;
    }
    setLocationStatus("locating");
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const immediate = placeFromCoordinates(latitude, longitude);
        setPlace(immediate);
        setLocationStatus("success");
        try {
          const response = await fetch(`/api/geocode?mode=reverse&lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`);
          if (!response.ok) return;
          const body = (await response.json()) as { place?: Partial<Place> };
          if (!body.place) return;
          setPlace((current) => {
            if (!current || current.id !== immediate.id) return current;
            return { ...immediate, ...body.place, latitude, longitude, id: immediate.id, source: "geolocation" };
          });
        } catch {
          return;
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus("denied");
          setLocationError("Location permission was denied. Search for a city or enable location access in your browser.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationStatus("unavailable");
          setLocationError("Your device could not determine a position. Search for a city instead.");
        } else if (error.code === error.TIMEOUT) {
          setLocationStatus("timeout");
          setLocationError("Locating timed out. Try again or search for a city.");
        } else {
          setLocationStatus("error");
          setLocationError("Could not read your location. Search for a city instead.");
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }, []);

  const value = useMemo<LocationsContextValue>(
    () => ({
      place,
      saved,
      hydrated,
      locationStatus,
      locationError,
      selectPlace,
      savePlace,
      removePlace,
      toggleSaved,
      isSaved,
      clearPlace,
      clearLocationError: () => setLocationError(null),
      requestMyLocation,
    }),
    [place, saved, hydrated, locationStatus, locationError, selectPlace, savePlace, removePlace, toggleSaved, isSaved, clearPlace, requestMyLocation]
  );

  return <LocationsContext.Provider value={value}>{children}</LocationsContext.Provider>;
}

export function useLocations(): LocationsContextValue {
  const context = useContext(LocationsContext);
  if (!context) throw new Error("useLocations must be used inside LocationsProvider");
  return context;
}
