import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Datavatia",
  description:
    "Datavatia collects no personal data. This page describes the few network requests the app makes.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-500">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-6 text-slate-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen overflow-y-auto bg-[#d8ddd8] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-300/80 bg-white/95 px-6 py-8 shadow-2xl sm:px-10">

        <div className="mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            DATAVATIA
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Effective September 1, 2026
          </p>
        </div>

        <Section title="The short version">
          <p>
            Datavatia does not collect, store, or
            share any personal information. There
            are no accounts, no analytics, no
            advertising, no tracking, and no
            cookies set by us. The datasets you
            explore are bundled with the
            application or served as static
            files.
          </p>
        </Section>

        <Section title="Network requests the app makes">
          <p>
            Like any interactive map, Datavatia
            requests content from a small number
            of services while you use it. These
            requests necessarily include your IP
            address, as all internet traffic
            does; we attach nothing else to them.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Esri (ArcGIS Online)</strong>{" "}
              serves the topographic basemap
              tiles. It receives the map areas
              you view (tile coordinates).
            </li>
            <li>
              <strong>
                Photon (komoot GmbH)
              </strong>{" "}
              provides address search. It
              receives the text you type into the
              search box, only when you use the
              search feature, solely to return
              matching places.
            </li>
            <li>
              <strong>MapLibre</strong> demo
              servers provide map label font
              files.
            </li>
          </ul>
          <p>
            These services are operated by third
            parties under their own privacy
            policies. Datavatia sends them no
            identifiers beyond what the requests
            above inherently contain, and
            receives no information about you
            from them.
          </p>
        </Section>

        <Section title="Data that stays on your device">
          <p>
            Community summaries you create are
            generated on your device and copied
            to your clipboard only when you press
            the copy button. Nothing you do in
            Datavatia — selections, searches,
            summaries — is transmitted to us,
            because there is no server of ours to
            transmit to.
          </p>
        </Section>

        <Section title="The iOS app">
          <p>
            The Datavatia iOS app bundles the
            entire application and its datasets
            inside the app. It makes the same
            network requests described above and
            no others. It uses no device
            permissions — no location, no
            camera, no contacts.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If this policy changes, the new
            version will be posted at this
            address with an updated effective
            date. Questions and concerns can be
            raised on the project&apos;s public
            repository:{" "}
            <a
              href="https://github.com/abhikash123/datavatia/issues"
              className="font-semibold text-sky-800 underline underline-offset-2"
            >
              github.com/abhikash123/datavatia
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-slate-200 pt-5">
          <Link
            href="/"
            className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline"
          >
            ← Back to the map
          </Link>
        </div>

      </div>
    </div>
  );
}
