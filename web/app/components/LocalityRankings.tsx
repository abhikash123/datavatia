"use client";

import { useMemo, useState } from "react";
import type { LocalityStat } from "../lib/types";

type RankingKey =
  | "facilities"
  | "proposed"
  | "reported_MW"
  | "development_pressure";

type Props = {
  localities: LocalityStat[];
  onSelect: (locality: LocalityStat) => void;
};

const TABS: {
  key: RankingKey;
  label: string;
  format: (l: LocalityStat) => string;
}[] = [
  {
    key: "facilities",
    label: "Facilities",
    format: (l) => l.facilities.toLocaleString(),
  },
  {
    key: "proposed",
    label: "Proposed",
    format: (l) => l.proposed.toLocaleString(),
  },
  {
    key: "reported_MW",
    label: "Reported MW",
    format: (l) =>
      `${l.reported_MW.toLocaleString()} MW`,
  },
  {
    key: "development_pressure",
    label: "Pressure",
    format: (l) =>
      l.development_pressure === null
        ? "—"
        : `${l.development_pressure}`,
  },
];

export default function LocalityRankings({
  localities,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] =
    useState<RankingKey>("facilities");

  const ranked = useMemo(() => {
    return [...localities]
      .sort(
        (a, b) =>
          (b[tab] ?? -1) - (a[tab] ?? -1)
      )
      .slice(0, 10);
  }, [localities, tab]);

  const activeTab = TABS.find(
    (t) => t.key === tab
  )!;

  return (
    <section
      aria-label="Locality rankings"
      className="pointer-events-auto w-64 rounded-2xl border border-slate-300/80 bg-white/95 shadow-2xl backdrop-blur"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
      >
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            RANKINGS
          </span>
          <span className="block text-sm font-bold text-slate-900">
            Locality rankings
          </span>
        </span>

        <svg
          aria-hidden="true"
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-3 pb-3">

          <div
            role="tablist"
            aria-label="Ranking metric"
            className="my-2 grid grid-cols-2 gap-1"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 ${
                  tab === t.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ol className="space-y-0.5">
            {ranked.map((locality, index) => (
              <li key={locality.name}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect(locality)
                  }
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="w-4 shrink-0 text-right text-[10px] font-bold text-slate-400">
                      {index + 1}
                    </span>
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {locality.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-slate-500">
                    {activeTab.format(locality)}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <p className="mt-2 px-2 text-[10px] leading-4 text-slate-400">
            {tab === "development_pressure"
              ? "Population-weighted mean of block-group development pressure scores in each locality."
              : "Counted from the facility dataset."}{" "}
            Click a locality to zoom to it.
          </p>

        </div>
      )}
    </section>
  );
}
