"use client";

import type {
  DataCenter,
  VaStats,
} from "../lib/types";

type Props = {
  dataCenters: DataCenter[];
  stats: VaStats | null;
  onOpenMethodology: () => void;
};

function Stat({
  label,
  value,
  tone,
  hiddenOnSmall,
}: {
  label: string;
  value: string;
  tone?: string;
  hiddenOnSmall?: boolean;
}) {
  return (
    <div
      className={
        hiddenOnSmall ? "hidden lg:block" : ""
      }
    >
      <div className="text-[9px] font-bold tracking-widest text-slate-500">
        {label}
      </div>

      <div
        className={`text-sm font-bold ${tone ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function StatsHeader({
  dataCenters,
  stats,
  onOpenMethodology,
}: Props) {
  const proposedCount = dataCenters.filter(
    (d) => d.Build_Status === "Proposed"
  ).length;

  const existingCount = dataCenters.filter(
    (d) => d.Build_Status === "Existing"
  ).length;

  const totalMW = dataCenters.reduce(
    (sum, center) =>
      sum +
      (typeof center.MW_reported === "number"
        ? center.MW_reported
        : 0),
    0
  );

  const localityCount = new Set(
    dataCenters
      .map((d) => d.Locality)
      .filter(Boolean)
  ).size;

  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-30">

      <div className="flex items-center justify-between gap-4 border-b border-slate-300/60 bg-white/92 px-4 py-3 shadow-md backdrop-blur sm:px-7 sm:py-4">

        <div className="min-w-0">

          <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
            DATAVATIA
          </h1>

          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500 sm:block">
            Mapping the hidden cost of data infrastructure
          </p>

        </div>

        <div className="pointer-events-auto flex items-center gap-4 sm:gap-6">

          <Stat
            label="FACILITIES"
            value={dataCenters.length.toLocaleString()}
          />

          <Stat
            label="PROPOSED"
            value={proposedCount.toLocaleString()}
            tone="text-red-600"
          />

          <Stat
            label="EXISTING"
            value={existingCount.toLocaleString()}
            tone="text-orange-600"
          />

          <Stat
            label="REPORTED POWER"
            value={`${totalMW.toLocaleString()} MW`}
            hiddenOnSmall
          />

          <Stat
            label="LOCALITIES"
            value={localityCount.toLocaleString()}
            hiddenOnSmall
          />

          {stats && (
            <Stat
              label="COMMUNITIES WITHIN 3 MI"
              value={stats.communities_near_facilities.toLocaleString()}
              hiddenOnSmall
            />
          )}

          <button
            type="button"
            onClick={onOpenMethodology}
            className="hidden rounded-xl border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 md:block"
          >
            Data &amp; Methodology
          </button>

        </div>

      </div>

    </header>
  );
}
