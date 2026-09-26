"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Globe2,
  Info,
  MapPin,
  Radio,
  ShieldAlert,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { useUnits } from "@/components/providers/UnitsProvider";
import { PanelHeader, Reveal } from "@/components/ui/Card";
import { DataStamp, ErrorState, Skeleton, SourceNote, UnavailableState } from "@/components/ui/States";
import { dateTimeLabel, relativeFromNow } from "@/lib/time";
import { formatNumber } from "@/lib/units";
import type { AlertProviderId, AlertRegionStatus, NormalizedAlert } from "@/lib/alerts";

const SEVERITY_ORDER: Record<string, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

function severityTone(severity: string): { label: string; color: string; border: string } {
  switch (severity) {
    case "extreme":
      return { label: "Extreme", color: "#f2777f", border: "rgba(242,119,127,0.42)" };
    case "severe":
      return { label: "Severe", color: "#eb9a6a", border: "rgba(235,154,106,0.42)" };
    case "moderate":
      return { label: "Moderate", color: "#dfc27a", border: "rgba(223,194,122,0.36)" };
    case "minor":
      return { label: "Minor", color: "#9fb0c4", border: "rgba(159,176,196,0.32)" };
    default:
      return { label: "Unrated", color: "#8c93a0", border: "rgba(140,147,160,0.32)" };
  }
}

function windowLabel(alert: NormalizedAlert, timeZone: string | undefined, hour12: boolean): string {
  if (alert.expires !== null) {
    return `Until ${dateTimeLabel(alert.expires, timeZone, hour12)} (${relativeFromNow(alert.expires)})`;
  }
  if (alert.effective !== null) {
    return `From ${dateTimeLabel(alert.effective, timeZone, hour12)} · no end time published`;
  }
  return "No validity window published by the provider";
}

function AlertCard({
  alert,
  timeZone,
  hour12,
  distanceLabel,
}: {
  alert: NormalizedAlert;
  timeZone: string | undefined;
  hour12: boolean;
  distanceLabel: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const tone = severityTone(alert.severity);
  const detail = alert.description?.trim() ?? "";
  const longDetail = detail.length > 240;
  const shown = expanded || !longDetail ? detail : `${detail.slice(0, 240).trimEnd()}…`;

  return (
    <motion.article
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="relative py-6 pl-5 first:pt-2 sm:pl-7"
    >
      <span
        aria-hidden
        className="absolute inset-y-6 left-0 w-[2px] rounded-full opacity-80"
        style={{ background: `linear-gradient(180deg, ${tone.color}, rgba(255,255,255,0))` }}
      />
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-[720px]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-bold tracking-[0.14em] uppercase"
              style={{ color: tone.color, background: "rgba(255,255,255,0.045)", boxShadow: `inset 0 0 0 1px ${tone.border}` }}
            >
              <AlertTriangle aria-hidden className="h-3 w-3" />
              {tone.label}
            </span>
            <span className="muted inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
              {alert.scope === "local-warning" ? (
                <>
                  <Radio aria-hidden className="h-3 w-3" /> Local official warning
                </>
              ) : (
                <>
                  <Globe2 aria-hidden className="h-3 w-3" /> Large-scale hazard
                </>
              )}
            </span>
            {alert.urgency ? (
              <span className="muted-dim text-[10px] tracking-[0.1em] uppercase">urgency {alert.urgency}</span>
            ) : null}
            {alert.certainty ? (
              <span className="muted-dim text-[10px] tracking-[0.1em] uppercase">certainty {alert.certainty}</span>
            ) : null}
          </div>
          <h3 className="mt-3 text-[20px] leading-[1.2] font-semibold tracking-[-0.015em] text-ink sm:text-[23px]">
            {alert.event}
          </h3>
          <p className="muted mt-2 text-[12.5px] leading-relaxed">{alert.headline}</p>
        </div>
        {alert.web ? (
          <a
            href={alert.web}
            target="_blank"
            rel="noreferrer noopener"
            title="Open the provider's own page for this alert"
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:border-pearl/50 hover:text-ink"
          >
            Source page <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-x-10 gap-y-4 border-t border-line/70 pt-4 sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <MapPin aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-dim" />
          <div className="min-w-0">
            <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Area</dt>
            <dd className="mt-1 text-[11.5px] leading-snug text-ink-soft">{alert.area}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Info aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-dim" />
          <div className="min-w-0">
            <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Validity</dt>
            <dd className="tnum mt-1 text-[11.5px] leading-snug text-ink-soft">{windowLabel(alert, timeZone, hour12)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Radio aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-dim" />
          <div className="min-w-0">
            <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Issued by</dt>
            <dd className="mt-1 text-[11.5px] leading-snug text-ink-soft">
              {alert.providerLabel}
              {alert.issued !== null ? ` · ${dateTimeLabel(alert.issued, timeZone, hour12)}` : ""}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-dim" />
          <div className="min-w-0">
            <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Match against this place</dt>
            <dd className="mt-1 text-[11.5px] leading-snug text-ink-soft">
              {alert.matchReason}
              {distanceLabel ? ` · ${distanceLabel}` : ""}
            </dd>
          </div>
        </div>
      </dl>

      {detail ? (
        <div className="mt-4 border-t border-line/70 pt-4">
          <p className="text-[12.5px] leading-relaxed text-ink-soft whitespace-pre-line">{shown}</p>
          {longDetail ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="focus-ring text-ink mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold underline decoration-line-strong underline-offset-4 transition hover:decoration-pearl"
            >
              {expanded ? "Show less" : "Read the full bulletin"}
              <ChevronDown aria-hidden className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </div>
      ) : null}

      {alert.instruction ? (
        <div className="mt-4 border-l-2 pl-4" style={{ borderColor: tone.border }}>
          <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Instruction from the agency</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft whitespace-pre-line">{alert.instruction}</p>
        </div>
      ) : null}
    </motion.article>
  );
}

function ProviderRow({ status }: { status: AlertRegionStatus }) {
  return (
    <div className="flex items-start gap-3 border-t border-line/70 py-3.5">
      <span className={`mt-[3px] shrink-0 ${status.available ? "text-mint" : "text-muted-dim"}`}>
        {status.available ? <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> : <XCircle aria-hidden className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold text-ink-soft">{status.label}</p>
        <p className="muted mt-0.5 text-[11px] leading-relaxed">{status.reason}</p>
        <p className="muted-dim mt-1 text-[10px] leading-relaxed">
          {status.coverage} · {status.attribution}
        </p>
      </div>
    </div>
  );
}

const PROVIDER_ORDER: AlertProviderId[] = ["nws", "sachet", "gdacs", "meteoalarm"];

export function AlertsView() {
  const { alerts, place, timeZone } = useDashboard();
  const { units, convert, symbol } = useUnits();
  const [filter, setFilter] = useState<"all" | "local-warning" | "global-hazard">("all");
  const radiusLabel = units.distance === "mi" ? `${formatNumber(convert.distance(400), 0)} ${symbol.distance}` : "400 km";

  if (alerts.loading && !alerts.data) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-20 w-56" />
          <Skeleton className="mt-6 h-16 w-full" />
        </div>
        <div className="glass rounded-[30px] p-6 sm:p-8">
          <Skeleton className="h-4 w-28" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (alerts.error && !alerts.data) {
    return <ErrorState title="Alerts unavailable" message={alerts.error} onRetry={alerts.refresh} />;
  }

  const payload = alerts.data;
  if (!payload) {
    return (
      <UnavailableState
        title="No alert response"
        message="No alert provider responded for this location. Nothing is being shown rather than showing an unverified warning."
      />
    );
  }

  const statuses = [...payload.statuses].sort(
    (a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)
  );
  const list = [...payload.alerts]
    .filter((alert) => filter === "all" || alert.scope === filter)
    .sort((a, b) => {
      const rank = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      return rank !== 0 ? rank : (b.issued ?? 0) - (a.issued ?? 0);
    });

  const mostSevere = [...payload.alerts].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  )[0] ?? null;
  const mostSevereTone = mostSevere ? severityTone(mostSevere.severity) : null;

  const localCount = payload.alerts.filter((alert) => alert.scope === "local-warning").length;
  const hazardCount = payload.alerts.filter((alert) => alert.scope === "global-hazard").length;
  const extremeCount = payload.alerts.filter((alert) => alert.severity === "extreme" || alert.severity === "severe").length;

  const mixBySeverity = new Map<string, number>();
  for (const alert of payload.alerts) {
    mixBySeverity.set(alert.severity, (mixBySeverity.get(alert.severity) ?? 0) + 1);
  }
  const mix = [...mixBySeverity.entries()]
    .map(([severity, count]) => ({
      severity,
      count,
      label: severityTone(severity).label,
      color: severityTone(severity).color,
      share: (count / payload.alerts.length) * 100,
    }))
    .sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0));

  return (
    <div className="space-y-7">
      <Reveal>
        <section className="relative overflow-hidden rounded-[30px] border border-line/60 bg-[radial-gradient(125%_150%_at_0%_-10%,rgba(255,255,255,0.075),rgba(255,255,255,0.014)_55%,transparent)] px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
            <div>
              <p className="muted-dim flex items-center gap-2 text-[10px] font-semibold tracking-[0.24em] uppercase">
                <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Official warnings · {radiusLabel} radius
              </p>
              <div className="mt-3 flex items-end gap-4">
                <p className="tnum text-[76px] leading-[0.84] font-semibold tracking-[-0.05em] text-ink sm:text-[88px]">
                  {payload.alerts.length}
                </p>
                <div className="pb-2.5">
                  <p className="text-[15px] font-semibold text-ink">
                    active {payload.alerts.length === 1 ? "warning" : "warnings"}
                  </p>
                  <p className="muted-dim mt-0.5 text-[11px]">matched to {place?.name ?? "this location"}</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 sm:ml-auto sm:max-w-[440px]">
              {mostSevere && mostSevereTone ? (
                <>
                  <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Highest severity in force</p>
                  <p className="mt-2 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-ink">{mostSevere.event}</p>
                  <p className="mt-1.5 text-[11.5px] font-semibold" style={{ color: mostSevereTone.color }}>
                    {mostSevereTone.label} · {mostSevere.providerLabel}
                  </p>
                  <p className="muted mt-1 text-[11px]">{windowLabel(mostSevere, timeZone ?? undefined, units.hour12)}</p>
                </>
              ) : (
                <>
                  <p className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Highest severity in force</p>
                  <p className="mt-2 text-[15px] leading-snug font-semibold text-ink-soft">
                    Nothing is in force for this place right now.
                  </p>
                  <p className="muted mt-1.5 text-[11px] leading-relaxed">
                    {payload.anyProviderSucceeded
                      ? "Every reachable provider answered without an alert covering this location."
                      : "No provider answered, so AETHER cannot say whether warnings are in force."}
                  </p>
                </>
              )}
            </div>
          </div>
          <dl className="mt-7 grid gap-x-8 gap-y-4 border-t border-line/70 pt-5 sm:grid-cols-3">
            <div>
              <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Local official warnings</dt>
              <dd className="tnum mt-1.5 text-[26px] leading-none font-semibold text-ink">{localCount}</dd>
            </div>
            <div>
              <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Large-scale hazards</dt>
              <dd className="tnum mt-1.5 text-[26px] leading-none font-semibold text-ink">{hazardCount}</dd>
            </div>
            <div>
              <dt className="muted-dim text-[9.5px] font-semibold tracking-[0.2em] uppercase">Severe or extreme</dt>
              <dd
                className="tnum mt-1.5 text-[26px] leading-none font-semibold"
                style={{ color: extremeCount > 0 ? "#f2777f" : undefined }}
              >
                <span className={extremeCount > 0 ? "" : "text-ink"}>{extremeCount}</span>
              </dd>
            </div>
          </dl>
          <DataStamp
            lastUpdated={alerts.lastUpdated}
            stale={alerts.stale}
            refreshing={alerts.refreshing}
            staleLabel="Alert check is overdue."
          />
          <SourceNote>
            Alerts are reproduced from the issuing agency. Severity, area and validity come from the provider payload; distance is
            measured from this place to the alert area centre and is an approximation.
          </SourceNote>
        </section>
      </Reveal>

      {payload.alerts.length === 0 ? (
        <Reveal delay={0.06}>
          {payload.anyProviderSucceeded ? (
            <UnavailableState
              title="No active warnings matched"
              message="Every reachable provider responded without an alert covering this location, or the alerts that exist fall outside the match area. This is a normal result, not an error."
              icon={<ShieldOff aria-hidden className="h-5 w-5" />}
            />
          ) : (
            <UnavailableState
              title="No provider could be reached"
              message="None of the configured alert providers returned a response, so AETHER cannot say whether warnings are in force. Check the provider coverage below for the individual reasons."
              icon={<ShieldOff aria-hidden className="h-5 w-5" />}
            />
          )}
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.06}>
            <section className="rule pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
                <h2 className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
                  Bulletins
                </h2>
                <div className="inline-flex rounded-full border border-line bg-white/[0.03] p-[3px]">
                  {(
                    [
                      { value: "all" as const, label: `All ${payload.alerts.length}` },
                      { value: "local-warning" as const, label: `Local ${localCount}` },
                      { value: "global-hazard" as const, label: `Hazards ${hazardCount}` },
                    ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={filter === option.value}
                      onClick={() => setFilter(option.value)}
                      className={`focus-ring rounded-full px-3 py-1 text-[10.5px] font-semibold transition ${
                        filter === option.value ? "bg-pearl text-[#06070a]" : "muted hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="muted mt-2.5 text-[11px]">
                {extremeCount} at severe or extreme level · fetched {relativeFromNow(payload.fetchedAt)} · matched within{" "}
                {radiusLabel} of {place?.name ?? "this location"}
              </p>
              <div className="mt-4 divide-y divide-white/10">
                <AnimatePresence initial={false}>
                  {list.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      timeZone={timeZone ?? undefined}
                      hour12={units.hour12}
                      distanceLabel={
                        alert.distanceKm === null
                          ? null
                          : `${formatNumber(convert.distance(alert.distanceKm), 0)} ${symbol.distance} away`
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
              {list.length === 0 ? (
                <p className="muted mt-4 text-xs">No alert in this filter. Switch back to All to see every matched alert.</p>
              ) : null}
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section className="glass-pearl relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-8 sm:py-8">
              <p className="text-[9.5px] font-semibold tracking-[0.24em] text-[#5a616d] uppercase">Severity mix</p>
              <h2 className="mt-2 text-[26px] leading-none font-semibold tracking-[-0.02em] text-[#12141a] sm:text-[30px]">
                How this set breaks down
              </h2>
              <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-[rgba(12,14,20,0.08)]">
                {mix.map((entry) => (
                  <span
                    key={entry.severity}
                    title={`${entry.label}: ${entry.count}`}
                    style={{ width: `${entry.share}%`, background: entry.color }}
                  />
                ))}
              </div>
              <div className="pearl-rule mt-6 grid gap-x-10 gap-y-5 pt-6 sm:grid-cols-2 xl:grid-cols-3">
                {mix.map((entry) => (
                  <div key={entry.severity}>
                    <p className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.2em] text-[#5a616d] uppercase">
                      <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                      {entry.label}
                    </p>
                    <p className="tnum mt-1.5 flex items-baseline gap-1.5 text-[23px] leading-none font-semibold tracking-[-0.02em] text-[#12141a]">
                      {entry.count}
                      <span className="text-[11.5px] font-medium text-[#5a616d]">
                        {entry.count === 1 ? "bulletin" : "bulletins"}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-[#5a616d]">
                      {formatNumber(entry.share, 0)}% of the warnings matched here
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[11px] leading-relaxed text-[#5a616d]">
                Severity wording is reproduced from the issuing agency. The colour scale is AETHER&apos;s own ordering of those
                levels and is not part of any official warning format, and no level is drawn when no bulletin carries it.
              </p>
            </section>
          </Reveal>
        </>
      )}

      <Reveal delay={0.14}>
        <section className="rule pt-6">
          <PanelHeader
            title="Provider coverage"
            subtitle="Which official sources are reachable for this location, and which are not."
            icon={<Radio className="h-4 w-4" />}
          />
          <div className="mt-2 grid gap-x-10 sm:grid-cols-2">
            {statuses.map((status) => (
              <ProviderRow key={status.provider} status={status} />
            ))}
          </div>
          <SourceNote>
            National warning services publish through their own channels. AETHER only reads the public interfaces named above and never
            relabels a forecast as an official warning.
          </SourceNote>
        </section>
      </Reveal>
    </div>
  );
}
