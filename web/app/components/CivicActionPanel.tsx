"use client";

import { useEffect, useState } from "react";
import type {
  ImpactRecord,
  Selection,
} from "../lib/types";
import {
  OFFICIAL_LOOKUPS,
  buildCommunitySummary,
} from "../lib/civic";

type Props = {
  selection: Selection;
  impact: ImpactRecord | null;
};

async function copyText(
  text: string
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CivicActionPanel({
  selection,
  impact,
}: Props) {
  const [showReps, setShowReps] =
    useState(false);
  const [summary, setSummary] = useState<
    string | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // A new selection describes a different place; drop the
  // previous summary so stale text is never copied.
  useEffect(() => {
    setSummary(null);
    setCopied(false);
    setShared(false);
  }, [selection]);

  async function handleCopy() {
    if (!summary) return;

    const ok = await copyText(summary);
    setCopied(ok);

    if (ok) {
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Datavatia community analysis",
          text: "Virginia data-center infrastructure analysis",
          url,
        });
        return;
      } catch {
        // Cancelled or unsupported — fall through to copy.
      }
    }

    const ok = await copyText(url);
    setShared(ok);

    if (ok) {
      setTimeout(() => setShared(false), 2500);
    }
  }

  return (
    <section
      aria-label="Community action"
      className="pointer-events-auto w-72 rounded-2xl border border-slate-300/80 bg-white/95 shadow-2xl backdrop-blur"
    >

      <div className="border-b border-slate-200 px-5 py-3.5">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">
          COMMUNITY ACTION
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Understand local development and
          connect with your representatives.
        </p>
      </div>

      <div className="space-y-2 px-4 py-3">

        {/* FIND REPRESENTATIVES */}

        <button
          type="button"
          aria-expanded={showReps}
          onClick={() => setShowReps(!showReps)}
          className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-left text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
        >
          Find My Representatives
        </button>

        {showReps && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] leading-4 text-slate-500">
              Districts and officeholders
              change, so Datavatia links to
              official government lookups
              instead of storing representative
              information.
            </p>

            {OFFICIAL_LOOKUPS.map((lookup) => (
              <a
                key={lookup.url}
                href={lookup.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-sky-300 hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                <span className="block text-xs font-bold text-sky-800">
                  {lookup.label} ↗
                </span>
                <span className="block text-[10px] leading-4 text-slate-500">
                  {lookup.description}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* COMMUNITY SUMMARY */}

        {!summary ? (
          <button
            type="button"
            onClick={() =>
              setSummary(
                buildCommunitySummary(
                  selection,
                  impact
                )
              )
            }
            className="w-full rounded-xl border border-sky-700 px-4 py-2.5 text-left text-sm font-bold text-sky-800 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
          >
            Create Community Summary
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              readOnly
              aria-label="Community summary"
              value={summary}
              rows={9}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-4 text-slate-700 outline-none focus:border-sky-400"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 rounded-xl bg-sky-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              >
                {copied
                  ? "Copied ✓"
                  : "Copy Summary"}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
              >
                {shared
                  ? "Link copied ✓"
                  : "Share This Analysis"}
              </button>
            </div>

            <p className="text-[10px] leading-4 text-slate-400">
              Paste the summary into an email,
              document, or community discussion.
              Datavatia never sends anything on
              your behalf.
            </p>
          </div>
        )}

      </div>

      <div className="border-t border-slate-200 px-5 py-3">
        <p className="text-[10px] leading-4 text-slate-400">
          Figures are Datavatia&apos;s
          analytical indicators derived from
          public data — not official government
          determinations. See Data &amp;
          Methodology.
        </p>
      </div>

    </section>
  );
}
