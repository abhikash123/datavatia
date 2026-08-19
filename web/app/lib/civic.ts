import type {
  ImpactRecord,
  Selection,
} from "./types";

// Official government lookup pages only. Individual
// legislators are never stored here: districts and
// officeholders change, so users are routed to live official
// lookups instead.
export const OFFICIAL_LOOKUPS = [
  {
    label: "Who's My Legislator? (Virginia General Assembly)",
    description:
      "Official address lookup for your Virginia House of Delegates and Senate members.",
    url: "https://whosmy.virginiageneralassembly.gov/",
  },
  {
    label: "Virginia House of Delegates",
    description:
      "Member directory and official contact information.",
    url: "https://virginiageneralassembly.gov/house/members/members.php",
  },
  {
    label: "Senate of Virginia",
    description:
      "Member directory and official contact information.",
    url: "https://apps.senate.virginia.gov/Senator/index.php",
  },
  {
    label: "USA.gov — Find Elected Officials",
    description:
      "Federal, state, and local officials by address.",
    url: "https://www.usa.gov/elected-officials",
  },
  {
    label: "Virginia.gov — Local Government",
    description:
      "Directory of Virginia county and city governments.",
    url: "https://www.virginia.gov/government/",
  },
] as const;

export const RESIDENT_QUESTIONS = [
  "What infrastructure planning is being done to accommodate projected data-center growth?",
  "How is local electrical capacity being planned for future development?",
  "What public information is available about proposed facilities in this area?",
  "How are residents notified about major infrastructure projects?",
  "What environmental or infrastructure assessments are required for proposed developments?",
] as const;

const NA = "Not available";

function fmt(
  value: number | null | undefined,
  suffix = ""
): string {
  if (value === null || value === undefined) {
    return NA;
  }

  return `${Math.round(value).toLocaleString()}${suffix}`;
}

function pressureInterpretation(
  score: number | null | undefined
): string {
  if (score === null || score === undefined) {
    return "Datavatia does not have enough data to characterize development pressure for this area.";
  }

  const band =
    score >= 75
      ? "among the highest in Virginia"
      : score >= 50
        ? "above the middle of Virginia communities"
        : score >= 25
          ? "below the middle of Virginia communities"
          : "among the lowest in Virginia";

  return (
    `Datavatia's development pressure indicator places this area ${band} ` +
    `(percentile score ${Math.round(score)} of 100). This is an analytical ` +
    `indicator derived from facility density, proposed development, and ` +
    `reported power within 3 miles — not an official government determination.`
  );
}

/** A neutral, plain-text summary built only from Datavatia's
 *  own data for the current selection. */
export function buildCommunitySummary(
  selection: Selection,
  impact: ImpactRecord | null
): string {
  const lines: string[] = [
    "COMMUNITY INFRASTRUCTURE SUMMARY",
    "(Prepared with Datavatia — analytical indicators, not official government determinations)",
    "",
  ];

  if (selection.kind === "community") {
    const p = selection.props;

    lines.push(
      `Location: Census block group ${p.GEOID}, Virginia`,
      `Population (2020 Census): ${fmt(p.population)}`,
      `Data centers within 3 miles: ${fmt(p.data_centers_3mi)}`,
      `Proposed facilities within 3 miles: ${fmt(p.proposed_centers_3mi)}`,
      `Reported power within 3 miles: ${
        p.reported_MW_3mi === null
          ? NA
          : `${p.reported_MW_3mi.toLocaleString()} MW (publicly reported only)`
      }`,
      `Development pressure score: ${fmt(p.development_pressure_score, " / 100")}`,
      `Datavatia impact level: ${p.impact_level ?? NA}`,
      `Data confidence: ${p.data_confidence ?? NA}`,
      "",
      "Interpretation:",
      pressureInterpretation(
        p.development_pressure_score
      )
    );
  } else if (selection.kind === "facility") {
    const c = selection.center;

    lines.push(
      `Location: ${c.Name ?? "Data center facility"}, ${
        c.Locality ?? "Virginia"
      }`,
      `Facility status: ${c.Build_Status ?? NA}`,
      `Reported capacity: ${
        c.MW_reported === null
          ? NA
          : `${c.MW_reported.toLocaleString()} MW`
      }`,
      `Population within 3 miles: ${fmt(impact?.Population_3_0mi)}`,
      `Other facilities within 3 miles: ${fmt(impact?.Facilities_3_0mi)}`,
      `Proposed facilities within 3 miles: ${fmt(impact?.Proposed_3_0mi)}`,
      `Datavatia impact level: ${impact?.Impact_Level ?? NA}`,
      `Data confidence: ${impact?.Data_Confidence ?? NA}`,
      "",
      "Interpretation:",
      "This summary describes one facility and the community around it using Datavatia's dataset. Facility details are as reported in public records; 3-mile figures are spatial estimates."
    );
  } else {
    const p = selection.community;
    const proposed = selection.nearby.filter(
      (n) =>
        n.center.Build_Status === "Proposed"
    ).length;
    const mw = selection.nearby.reduce(
      (sum, n) =>
        sum + (n.center.MW_reported ?? 0),
      0
    );

    lines.push(
      `Location: ${selection.label}`,
      `Census block group: ${p ? p.GEOID : NA}`,
      `Population (2020 Census): ${fmt(p?.population)}`,
      `Data centers within 3 miles: ${selection.nearby.length}`,
      `Proposed facilities within 3 miles: ${proposed}`,
      `Reported power within 3 miles: ${
        mw > 0
          ? `${mw.toLocaleString()} MW (publicly reported only)`
          : selection.nearby.length
            ? "None publicly reported"
            : NA
      }`,
      `Development pressure score: ${fmt(p?.development_pressure_score, " / 100")}`,
      `Datavatia impact level: ${p?.impact_level ?? NA}`,
      "",
      "Interpretation:",
      pressureInterpretation(
        p?.development_pressure_score
      )
    );
  }

  lines.push(
    "",
    "Questions a resident may want to ask local officials:",
    ...RESIDENT_QUESTIONS.map(
      (q) => `- ${q}`
    ),
    "",
    "Data sources: compiled Virginia data-center records and the 2020 U.S. Census. Details and limitations: see the Data & Methodology section of Datavatia."
  );

  return lines.join("\n");
}
