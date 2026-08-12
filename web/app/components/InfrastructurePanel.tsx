"use client";

import type { FacilityFilters } from "../lib/types";

type Props = {
  filters: FacilityFilters;
  localities: {
    name: string;
    count: number;
  }[];
  visibleCount: number;
  totalCount: number;
  onChange: (next: FacilityFilters) => void;
};

const MW_OPTIONS = [
  { value: null, label: "Any capacity" },
  { value: 25, label: "25+ MW reported" },
  { value: 100, label: "100+ MW reported" },
  { value: 300, label: "300+ MW reported" },
];

export default function InfrastructurePanel({
  filters,
  localities,
  visibleCount,
  totalCount,
  onChange,
}: Props) {
  const isDefault =
    filters.showProposed &&
    filters.showExisting &&
    filters.locality === null &&
    filters.query === "" &&
    filters.minMW === null;

  function set(
    partial: Partial<FacilityFilters>
  ) {
    onChange({ ...filters, ...partial });
  }

  return (
    <section
      aria-label="Facility filters"
      className="pointer-events-auto w-64 rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-2xl backdrop-blur"
    >

      <div className="mb-4">

        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          VIRGINIA
        </div>

        <h2 className="mt-1 text-lg font-bold">
          Infrastructure
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Showing {visibleCount.toLocaleString()}{" "}
          of {totalCount.toLocaleString()}{" "}
          facilities.
        </p>

      </div>

      {/* STATUS TOGGLES */}

      <div className="mb-3 space-y-1">

        <button
          type="button"
          aria-pressed={filters.showProposed}
          onClick={() =>
            set({
              showProposed:
                !filters.showProposed,
            })
          }
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full ${
                filters.showProposed
                  ? "bg-red-600"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-sm font-semibold">
              Proposed
            </span>
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {filters.showProposed ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={filters.showExisting}
          onClick={() =>
            set({
              showExisting:
                !filters.showExisting,
            })
          }
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full ${
                filters.showExisting
                  ? "bg-orange-500"
                  : "bg-slate-300"
              }`}
            />
            <span className="text-sm font-semibold">
              Existing
            </span>
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {filters.showExisting ? "ON" : "OFF"}
          </span>
        </button>

      </div>

      {/* SEARCH WITHIN FACILITIES */}

      <label className="mb-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Facility / developer
        </span>
        <input
          type="text"
          value={filters.query}
          onChange={(event) =>
            set({ query: event.target.value })
          }
          placeholder="Filter by name…"
          aria-label="Filter facilities by name or developer"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
        />
      </label>

      {/* LOCALITY */}

      <label className="mb-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Locality
        </span>
        <select
          value={filters.locality ?? ""}
          onChange={(event) =>
            set({
              locality:
                event.target.value || null,
            })
          }
          aria-label="Filter facilities by locality"
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-400"
        >
          <option value="">
            All localities
          </option>
          {localities.map((locality) => (
            <option
              key={locality.name}
              value={locality.name}
            >
              {locality.name} ({locality.count})
            </option>
          ))}
        </select>
      </label>

      {/* CAPACITY */}

      <label className="mb-1 block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Reported capacity
        </span>
        <select
          value={filters.minMW ?? ""}
          onChange={(event) =>
            set({
              minMW: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
          aria-label="Filter facilities by minimum reported capacity"
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-400"
        >
          {MW_OPTIONS.map((option) => (
            <option
              key={option.label}
              value={option.value ?? ""}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {!isDefault && (
        <button
          type="button"
          onClick={() =>
            onChange({
              showProposed: true,
              showExisting: true,
              locality: null,
              query: "",
              minMW: null,
            })
          }
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-center text-[11px] font-bold text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          Clear filters
        </button>
      )}

      {/* LEGEND */}

      <div className="mt-4 border-t border-slate-200 pt-3">

        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Legend
        </div>

        <div className="space-y-1.5 text-xs text-slate-600">

          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-red-600"
            />
            Proposed facility
          </div>

          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-orange-500"
            />
            Existing facility
          </div>

          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white"
            >
              9
            </span>
            Facility cluster (zoom to expand)
          </div>

        </div>

      </div>

    </section>
  );
}
