"use client";

import { Popup } from "react-map-gl/maplibre";
import type { DataCenter } from "../lib/types";

type Props = {
  center: DataCenter;
  onClose: () => void;
};

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500">
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export default function FacilityPopup({
  center,
  onClose,
}: Props) {
  if (
    typeof center.Long !== "number" ||
    typeof center.Lat !== "number"
  ) {
    return null;
  }

  const proposed =
    center.Build_Status === "Proposed";

  return (
    <Popup
      longitude={center.Long}
      latitude={center.Lat}
      anchor="bottom"
      closeButton={true}
      closeOnClick={false}
      onClose={onClose}
      maxWidth="360px"
    >
      <div className="w-[300px] p-2 text-slate-900">

        <div
          className={`mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
            proposed
              ? "text-red-600"
              : "text-orange-600"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              proposed
                ? "bg-red-600"
                : "bg-orange-500"
            }`}
          />
          {center.Build_Status ?? "Unknown status"}
        </div>

        <h2 className="mb-4 text-lg font-bold leading-tight">
          {center.Name ?? "Unnamed Facility"}
        </h2>

        <div className="space-y-3 text-sm">

          <Row
            label="Locality"
            value={center.Locality ?? "Unknown"}
          />

          {center.Owner_Applicant && (
            <Row
              label="Developer / Applicant"
              value={center.Owner_Applicant}
            />
          )}

          {center.Street_Address && (
            <Row
              label="Address"
              value={center.Street_Address}
            />
          )}

          {center.MW_reported !== null && (
            <Row
              label="Reported Power"
              value={`${center.MW_reported.toLocaleString()} MW`}
            />
          )}

          {center.Building_Sq_Ft !== null && (
            <Row
              label="Building Area"
              value={`${Number(
                center.Building_Sq_Ft
              ).toLocaleString()} sq ft`}
            />
          )}

          {center.Acres !== null && (
            <Row
              label="Site"
              value={`${Number(
                center.Acres
              ).toLocaleString()} acres`}
            />
          )}

          {center.Construction_Type && (
            <Row
              label="Construction"
              value={center.Construction_Type}
            />
          )}

          {center.Date_Updated && (
            <Row
              label="Record updated"
              value={center.Date_Updated}
            />
          )}

          {center.Source_link && (
            <a
              href={center.Source_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 underline-offset-2 hover:bg-slate-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
            >
              View source ↗
            </a>
          )}

        </div>

      </div>
    </Popup>
  );
}
