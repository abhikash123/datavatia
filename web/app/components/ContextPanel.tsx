"use client";

import type {
  CommunityProps,
  ImpactRecord,
  Selection,
} from "../lib/types";
import {
  formatCount,
  formatMW,
  formatMiles,
} from "../lib/format";

type Props = {
  selection: Selection;
  impact: ImpactRecord | null;
  onDismiss: () => void;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-xs text-slate-500">
          {label}
        </div>
        {hint && (
          <div className="text-[10px] text-slate-400">
            {hint}
          </div>
        )}
      </div>
      <div className="text-right text-sm font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function LevelBadge({
  level,
}: {
  level: string | null | undefined;
}) {
  if (!level) return <>—</>;

  const tone =
    level === "Very High"
      ? "bg-red-100 text-red-700"
      : level === "High"
        ? "bg-orange-100 text-orange-700"
        : level === "Moderate"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-sky-100 text-sky-700";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}
    >
      {level}
    </span>
  );
}

function CommunityMetrics({
  props,
}: {
  props: CommunityProps;
}) {
  return (
    <div className="space-y-2.5">
      <Metric
        label="Population"
        hint="2020 Census, reported"
        value={formatCount(props.population)}
      />
      <Metric
        label="Housing units"
        hint="2020 Census, reported"
        value={formatCount(props.housing_units)}
      />
      <Metric
        label="Data centers within 3 mi"
        hint="Calculated from facility locations"
        value={formatCount(
          props.data_centers_3mi
        )}
      />
      <Metric
        label="Proposed within 3 mi"
        value={formatCount(
          props.proposed_centers_3mi
        )}
      />
      <Metric
        label="Reported power within 3 mi"
        hint="Only publicly reported capacity"
        value={formatMW(props.reported_MW_3mi)}
      />
      <Metric
        label="Development pressure"
        hint="Percentile score, calculated"
        value={
          props.development_pressure_score ===
          null
            ? "—"
            : `${Math.round(
                props.development_pressure_score
              )} / 100`
        }
      />
      <Metric
        label="Impact level"
        hint="Proxy from development pressure"
        value={
          <LevelBadge
            level={props.impact_level}
          />
        }
      />
      <Metric
        label="Data confidence"
        value={props.data_confidence ?? "—"}
      />
    </div>
  );
}

export default function ContextPanel({
  selection,
  impact,
  onDismiss,
}: Props) {
  let heading = "";
  let subheading: string | null = null;
  let body: React.ReactNode = null;

  if (selection.kind === "community") {
    heading = "Community profile";
    subheading = `Census block group ${selection.props.GEOID}`;
    body = (
      <CommunityMetrics
        props={selection.props}
      />
    );
  } else if (selection.kind === "facility") {
    const center = selection.center;
    heading =
      center.Name ?? "Unnamed facility";
    subheading =
      center.Locality ?? "Virginia";

    body = (
      <div className="space-y-2.5">
        {impact ? (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Surrounding community
            </div>

            <Metric
              label="Population within 3 mi"
              hint="Calculated from Census data"
              value={formatCount(
                impact.Population_3_0mi
              )}
            />
            <Metric
              label="Population within 1 mi"
              value={formatCount(
                impact.Population_1_0mi
              )}
            />
            <Metric
              label="Housing within 3 mi"
              value={formatCount(
                impact.Housing_3_0mi
              )}
            />
            <Metric
              label="Other facilities within 3 mi"
              value={formatCount(
                impact.Facilities_3_0mi
              )}
            />
            <Metric
              label="Proposed within 3 mi"
              value={formatCount(
                impact.Proposed_3_0mi
              )}
            />
            <Metric
              label="Impact score"
              hint="Dataset composite, see methodology"
              value={
                impact.Impact_Score === null
                  ? "—"
                  : Math.round(
                      impact.Impact_Score
                    )
              }
            />
            <Metric
              label="Impact level"
              value={
                <LevelBadge
                  level={impact.Impact_Level}
                />
              }
            />
            <Metric
              label="Data confidence"
              value={
                impact.Data_Confidence ?? "—"
              }
            />
          </>
        ) : (
          <p className="text-xs text-slate-500">
            No community analysis is available
            for this facility.
          </p>
        )}
      </div>
    );
  } else {
    heading = "Location analysis";
    subheading = selection.label;

    body = (
      <div className="space-y-4">
        {selection.pending ? (
          <p className="text-xs text-slate-500">
            Analyzing surrounding community…
          </p>
        ) : (
          <>
            {selection.community ? (
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  This block group
                </div>
                <CommunityMetrics
                  props={selection.community}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No Virginia community data at
                this exact point.
              </p>
            )}

            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Facilities within 3 miles (
                {selection.nearby.length},
                calculated)
              </div>

              {selection.nearby.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No mapped data centers within 3
                  miles of this location.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {selection.nearby
                    .slice(0, 6)
                    .map(
                      ({
                        center,
                        distanceMiles,
                      }) => (
                        <li
                          key={center.OBJECTID}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                center.Build_Status ===
                                "Proposed"
                                  ? "bg-red-600"
                                  : "bg-orange-500"
                              }`}
                            />
                            <span className="truncate font-semibold text-slate-700">
                              {center.Name ??
                                "Unnamed"}
                            </span>
                          </span>
                          <span className="shrink-0 text-slate-500">
                            {formatMiles(
                              distanceMiles
                            )}
                          </span>
                        </li>
                      )
                    )}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={heading}
      className="pointer-events-auto w-72 rounded-2xl border border-slate-300/80 bg-white/95 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900">
            {heading}
          </h2>
          {subheading && (
            <p className="truncate text-[11px] text-slate-500">
              {subheading}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss panel"
          onClick={onDismiss}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="max-h-[45vh] overflow-y-auto px-5 py-4">
        {body}
      </div>
    </section>
  );
}
