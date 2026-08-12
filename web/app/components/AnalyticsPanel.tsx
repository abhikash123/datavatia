"use client";

import type {
  AnalysisMode,
  CommunityStatus,
} from "../lib/types";
import { MODE_CONFIG } from "../lib/mapConfig";

type Props = {
  analysisMode: AnalysisMode;
  communityStatus: CommunityStatus;
  onSelect: (mode: AnalysisMode) => void;
};

const MODES = [
  "community",
  "development",
  "power",
  "impact",
] as const;

export default function AnalyticsPanel({
  analysisMode,
  communityStatus,
  onSelect,
}: Props) {
  const activeConfig =
    analysisMode !== "none"
      ? MODE_CONFIG[analysisMode]
      : null;

  return (
    <section
      aria-label="Analysis modes"
      className="pointer-events-auto w-72 rounded-2xl border border-slate-300/80 bg-white/95 shadow-2xl backdrop-blur"
    >

      <div className="border-b border-slate-200 px-5 py-4">

        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          DATAVATIA ANALYTICS
        </div>

        <h2 className="mt-1 text-lg font-bold">
          Analyze Virginia
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Turn infrastructure data into
          measurable community impacts.
        </p>

      </div>

      <div className="space-y-1 p-3">

        {MODES.map((mode) => {
          const config = MODE_CONFIG[mode];
          const active = analysisMode === mode;

          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(mode)}
              className={`w-full rounded-xl px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 ${
                active
                  ? mode === "community"
                    ? "bg-green-700 text-white"
                    : "bg-slate-900 text-white"
                  : "hover:bg-slate-100"
              }`}
            >

              <div className="text-sm font-bold">
                {config.title}
              </div>

              <div
                className={`mt-1 text-[11px] ${
                  active
                    ? "text-slate-100/90"
                    : "text-slate-500"
                }`}
              >
                {config.subtitle}
              </div>

            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelect("none")}
          className="w-full rounded-xl px-4 py-2 text-center text-[11px] font-bold text-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          Clear analysis
        </button>

      </div>

      {activeConfig &&
        communityStatus === "ready" && (

        <div className="border-t border-slate-200 px-5 py-4">

          <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {activeConfig.legendTitle}
          </div>

          <div className="space-y-2 text-xs">
            {activeConfig.legend.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded"
                  style={{
                    backgroundColor: entry.color,
                  }}
                />
                <span>{entry.label}</span>
              </div>
            ))}
          </div>

          {activeConfig.note && (
            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              {activeConfig.note}
            </p>
          )}

        </div>
      )}

      {analysisMode !== "none" &&
        communityStatus === "loading" && (

        <div className="border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-500">
          Loading community data...
        </div>

      )}

      {analysisMode !== "none" &&
        communityStatus === "error" && (

        <div className="border-t border-slate-200 px-5 py-4 text-center text-xs font-semibold text-red-600">
          Community data could not be loaded.
          Select an analysis again to retry.
        </div>

      )}

    </section>
  );
}
