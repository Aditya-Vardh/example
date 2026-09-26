export function localIsoToEpoch(iso: string | null | undefined, utcOffsetSeconds: number): number | null {
  if (!iso) return null;
  const parsed = Date.parse(`${iso}Z`);
  if (!Number.isFinite(parsed)) return null;
  return parsed - utcOffsetSeconds * 1000;
}

export function offsetTag(utcOffsetSeconds: number): string {
  const sign = utcOffsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(utcOffsetSeconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatInZone(
  epoch: number | null,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
  locale?: string
): string {
  if (epoch === null) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: timeZone || "UTC" }).format(epoch);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(epoch);
  }
}

export function hourLabel(epoch: number | null, timeZone: string | undefined, hour12: boolean): string {
  return formatInZone(epoch, timeZone, { hour: "2-digit", minute: "2-digit", hour12 }, undefined);
}

export function shortHourLabel(epoch: number | null, timeZone: string | undefined, hour12: boolean): string {
  return formatInZone(epoch, timeZone, { hour: "numeric", hour12 }, undefined);
}

export function dayLabel(epoch: number | null, timeZone: string | undefined, length: "short" | "long" = "short"): string {
  return formatInZone(epoch, timeZone, { weekday: length }, undefined);
}

export function dateLabel(epoch: number | null, timeZone: string | undefined): string {
  return formatInZone(epoch, timeZone, { day: "numeric", month: "short" }, undefined);
}

export function fullDayLabel(epoch: number | null, timeZone: string | undefined): string {
  return formatInZone(epoch, timeZone, { weekday: "long", day: "numeric", month: "long" }, undefined);
}

export function dateTimeLabel(epoch: number | null, timeZone: string | undefined, hour12: boolean): string {
  return formatInZone(epoch, timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12 }, undefined);
}

export function clockLabel(epoch: number | null, timeZone: string | undefined, hour12: boolean): string {
  return formatInZone(epoch, timeZone, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12 }, undefined);
}

export function zoneAbbreviation(epoch: number, timeZone: string | undefined): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", timeZoneName: "shortOffset" }).formatToParts(epoch);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function relativeFromNow(epoch: number | null, now: number = Date.now()): string {
  if (epoch === null) return "";
  const delta = Math.round((now - epoch) / 1000);
  const abs = Math.abs(delta);
  if (abs < 45) return delta >= 0 ? "just now" : "in a moment";
  if (abs < 3600) {
    const mins = Math.round(abs / 60);
    return delta >= 0 ? `${mins} min ago` : `in ${mins} min`;
  }
  if (abs < 86400) {
    const hours = Math.round(abs / 3600);
    return delta >= 0 ? `${hours} hr ago` : `in ${hours} hr`;
  }
  const days = Math.round(abs / 86400);
  return delta >= 0 ? `${days} day${days === 1 ? "" : "s"} ago` : `in ${days} day${days === 1 ? "" : "s"}`;
}

export function dayKey(epoch: number, timeZone: string | undefined): string {
  return formatInZone(epoch, timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA");
}

export function isSameZoneDay(a: number, b: number, timeZone: string | undefined): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

export function durationLabel(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
