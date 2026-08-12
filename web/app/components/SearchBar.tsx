"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  geocode,
  type GeocodeResult,
} from "../lib/geocode";

type SearchStatus =
  | "idle"
  | "typing"
  | "loading"
  | "results"
  | "empty"
  | "error";

type Props = {
  onSelect: (result: GeocodeResult) => void;
  onClear: () => void;
};

export default function SearchBar({
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<SearchStatus>("idle");
  const [results, setResults] = useState<
    GeocodeResult[]
  >([]);
  const [highlighted, setHighlighted] =
    useState(-1);

  const abortRef = useRef<AbortController | null>(
    null
  );
  const debounceRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setStatus((s) =>
          s === "results" || s === "empty"
            ? "idle"
            : s
        );
      }
    }

    document.addEventListener(
      "mousedown",
      onDocClick
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onDocClick
      );
  }, []);

  function runSearch(text: string) {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");

    geocode(text, controller.signal)
      .then((found) => {
        setResults(found);
        setHighlighted(-1);
        setStatus(
          found.length ? "results" : "empty"
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Search failed:", error);
        setStatus("error");
      });
  }

  function handleChange(text: string) {
    setQuery(text);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (text.trim().length < 3) {
      abortRef.current?.abort();
      setResults([]);
      setStatus(text ? "typing" : "idle");
      return;
    }

    setStatus("typing");

    debounceRef.current = setTimeout(
      () => runSearch(text.trim()),
      350
    );
  }

  function choose(result: GeocodeResult) {
    setQuery(
      result.detail
        ? `${result.label}, ${result.detail}`
        : result.label
    );
    setResults([]);
    setStatus("idle");
    onSelect(result);
  }

  function clear() {
    abortRef.current?.abort();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setQuery("");
    setResults([]);
    setStatus("idle");
    onClear();
  }

  function onKeyDown(
    event: React.KeyboardEvent
  ) {
    if (status !== "results") {
      if (
        event.key === "Enter" &&
        query.trim().length >= 3
      ) {
        runSearch(query.trim());
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) =>
        Math.min(h + 1, results.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(
        results[
          highlighted >= 0 ? highlighted : 0
        ]
      );
    } else if (event.key === "Escape") {
      setStatus("idle");
    }
  }

  const showDropdown =
    status === "loading" ||
    status === "results" ||
    status === "empty" ||
    status === "error";

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto relative w-full max-w-md"
    >
      <div className="flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">

        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
          />
        </svg>

        <input
          type="text"
          role="combobox"
          aria-controls="search-results"
          aria-expanded={status === "results"}
          aria-label="Search for an address, city, ZIP code, or place in Virginia"
          placeholder="Search address, city, ZIP, or place…"
          value={query}
          onChange={(event) =>
            handleChange(event.target.value)
          }
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
        />

        {status === "loading" && (
          <span
            aria-label="Searching"
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          />
        )}

        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
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
        )}

      </div>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white/98 shadow-2xl backdrop-blur"
        >

          {status === "loading" && (
            <div className="px-4 py-3 text-xs text-slate-500">
              Searching…
            </div>
          )}

          {status === "empty" && (
            <div className="px-4 py-3 text-xs text-slate-500">
              No Virginia locations found. Try a
              street address, town, or ZIP code.
            </div>
          )}

          {status === "error" && (
            <div className="px-4 py-3 text-xs font-semibold text-red-600">
              Search is unavailable right now.
              Please try again.
            </div>
          )}

          {status === "results" &&
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                role="option"
                aria-selected={
                  index === highlighted
                }
                onClick={() => choose(result)}
                onMouseEnter={() =>
                  setHighlighted(index)
                }
                className={`block w-full px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500 ${
                  index === highlighted
                    ? "bg-slate-100"
                    : ""
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  {result.label}
                </div>

                {result.detail && (
                  <div className="text-xs text-slate-500">
                    {result.detail}
                  </div>
                )}
              </button>
            ))}

        </div>
      )}
    </div>
  );
}
