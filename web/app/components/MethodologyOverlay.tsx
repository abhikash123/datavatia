"use client";

import { useEffect } from "react";

type Props = {
  onClose: () => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      <div className="space-y-2 text-sm leading-6 text-slate-700">
        {children}
      </div>
    </section>
  );
}

export default function MethodologyOverlay({
  onClose,
}: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    return () =>
      document.removeEventListener(
        "keydown",
        onKey
      );
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Data and methodology"
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              DATAVATIA
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Data &amp; Methodology
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close methodology"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
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

        <div className="overflow-y-auto px-6 py-5">

          <Section title="What Datavatia measures">
            <p>
              Datavatia maps where data-center
              development in Virginia meets the
              communities around it. Data
              infrastructure can affect
              communities through land use,
              concentration of development,
              power demand and the
              infrastructure it requires,
              population exposure to large
              construction, and the sheer scale
              of proposed projects.
            </p>
            <p>
              Datavatia is a mapping and
              decision-support tool. It does not
              model or claim causal health,
              economic, or environmental effects
              of any individual facility.
            </p>
          </Section>

          <Section title="Data sources">
            <p>
              <strong>Data centers:</strong> a
              compiled dataset of Virginia
              data-center facilities included in
              this repository, carrying PEC
              record identifiers and, where
              available, public source links
              shown on each facility card.
              Status, acreage, square footage,
              and megawatts are as reported in
              that dataset.
            </p>
            <p>
              <strong>Communities:</strong> 2020
              U.S. Census block groups.
              Population and housing counts come
              from the 2020 Decennial Census
              (P.L. 94-171 tables P1 and H1).
              Boundaries shown on the map are the
              Census Bureau&apos;s 1:500,000
              cartographic boundary files.
            </p>
          </Section>

          <Section title="How metrics are calculated">
            <p>
              <strong>
                &ldquo;Within 3 miles&rdquo;:
              </strong>{" "}
              each facility location is buffered
              by 3 miles (4,828 m) in a metric
              projection (EPSG:32618). A block
              group counts as &ldquo;near&rdquo;
              a facility when its boundary
              intersects that buffer.
            </p>
            <p>
              <strong>
                Reported MW within 3 miles:
              </strong>{" "}
              the sum of publicly reported
              facility capacity within the
              buffer. Many facilities do not
              report capacity, so these totals
              understate real electrical demand.
            </p>
            <p>
              <strong>
                Development pressure score:
              </strong>{" "}
              a percentile rank (0–100)
              combining facility density (45%),
              proposed development (35%), and
              reported power (20%) within 3
              miles. Power is weighted least
              because MW reporting is
              incomplete.
            </p>
            <p>
              <strong>Impact score:</strong> a
              transparent weighted composite of
              average-rank percentiles (0–100)
              of four block-group metrics:
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs leading-6">
              Impact&nbsp;Score =<br />
              &nbsp;&nbsp;0.30 × population
              exposure
              <br />
              + 0.30 × facility density (3 mi)
              <br />
              + 0.20 × reported power (3 mi)
              <br />
              + 0.20 × proposed development (3
              mi)
            </p>
            <p>
              Facility density is used instead
              of the development pressure score
              as a component so no metric is
              double-counted (that score already
              blends density, proposed
              development, and power). A metric
              equal to zero scores zero for its
              component — a community with no
              facilities within 3 miles
              contributes nothing on the
              density, power, or proposed
              components; nonzero values are
              percentile-ranked against all
              communities. Each community
              profile shows the four weighted
              contributions, which sum to the
              score, so every value is
              reproducible from the published
              data.
            </p>
            <p>
              <strong>Impact level:</strong> a
              classification of the development
              pressure score (Lower &lt; 25 ≤
              Moderate &lt; 50 ≤ High &lt; 75 ≤
              Very High).
            </p>
            <p>
              <strong>
                Locality rankings:
              </strong>{" "}
              facility counts, proposed counts,
              and reported MW are summed from
              the facility dataset per locality.
              Development pressure per locality
              is the{" "}
              <strong>
                population-weighted mean
              </strong>{" "}
              of block-group scores in that
              county, so the ranking reflects
              conditions where residents
              actually live rather than empty
              land.
            </p>
            <p>
              <strong>
                Data confidence:
              </strong>{" "}
              a completeness rating per block
              group, counting whether facility
              counts, proposed development,
              reported MW, and Census population
              are all present (High ≥ 4 of 4,
              Moderate ≥ 2, otherwise Low). It
              rates how complete the inputs are,
              not how severe the impact is.
            </p>
          </Section>

          <Section title="Reported vs. derived values">
            <p>
              <strong>Directly reported:</strong>{" "}
              facility name, status, locality,
              address, developer, acreage,
              building square footage, reported
              MW, Census population and housing
              counts.
            </p>
            <p>
              <strong>Derived:</strong> all
              &ldquo;within N miles&rdquo;
              aggregations, development pressure
              scores, impact levels, data
              confidence ratings, and distances
              shown in location analyses
              (computed from coordinates).
            </p>
          </Section>

          <Section title="Limitations">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Facility records change as
                projects are announced, revised,
                or withdrawn; the dataset
                carries a per-record update
                date.
              </li>
              <li>
                Reported MW is missing for many
                facilities; power-related
                metrics are lower bounds.
              </li>
              <li>
                Block-group boundaries are
                generalized for display;
                area-based metrics use
                full-resolution boundaries
                during processing.
              </li>
              <li>
                Scores are relative percentiles
                within Virginia; they compare
                communities to each other, not
                to an absolute standard.
              </li>
              <li>
                Water-only block groups with
                zero population are omitted from
                the map.
              </li>
            </ul>
          </Section>

          <Section title="Community data vintage">
            <p>
              Census data: 2020. Facility
              records: per-record{" "}
              <em>Date updated</em> field shown
              on each facility card.
            </p>
          </Section>

          <Section title="Privacy">
            <p>
              Datavatia collects no personal
              data. See the{" "}
              <a
                href="/privacy"
                className="font-semibold text-sky-800 underline underline-offset-2"
              >
                Privacy Policy
              </a>{" "}
              for the few network requests the
              app makes.
            </p>
          </Section>

        </div>

      </div>
    </div>
  );
}
