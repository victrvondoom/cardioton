/**
 * Landing-page design tokens + copy.
 *
 * The landing page runs the pixel-native CardioTwin identity: near-black
 * canvas, five-colour pixel ramp, geometric sans. Colours live here (TS) as
 * well as in landing.css (CSS vars) because canvas-based pixel layers need
 * them as literal values, not CSS custom properties.
 */

export const pixelColorsDark = {
  void: "#0D0E10",
  panel: "#141518",
  bone: "#F7F7F4",
  muted: "#96979E",
  red: "#F0442B",
  orange: "#FF7900",
  yellow: "#FFB400",
  blue: "#39A9E8",
  green: "#59DFA6",
} as const;

export const pixelColorsLight = {
  void: "#FAFAF8",
  panel: "#FFFFFF",
  bone: "#141518",
  muted: "#6E6F76",
  red: "#D63A22",
  orange: "#E85D00",
  yellow: "#C77F00",
  blue: "#1D7FB8",
  green: "#178A5F",
} as const;

export type PixelLandingTheme = "dark" | "light";

export function getPixelLandingColors(theme: PixelLandingTheme) {
  return theme === "light" ? pixelColorsLight : pixelColorsDark;
}

/** @deprecated Use `getPixelLandingColors(theme)` — kept for any stray import. */
export const apertureColors = pixelColorsDark;

/** The six steps a prior-auth request passes through inside ClinCase. */
export const LIFECYCLE_STEPS = [
  {
    n: "01",
    title: "Referral lands",
    body: "A chart note, pathology report, or payer packet arrives — uploaded, faxed, or pushed from your EMR. No one retypes anything.",
  },
  {
    n: "02",
    title: "Text is screened, then indexed",
    body: "Recognized identifiers are redacted and recorded. Automated screening is not a guarantee of de-identification; review documents and deployment controls before using patient data.",
  },
  {
    n: "03",
    title: "The right policy is retrieved",
    body: "The agent retrieves the configured payer policy for that drug and indication — with the clause, the version, and the effective date.",
  },
  {
    n: "04",
    title: "Evidence is matched to criteria",
    body: "Every policy criterion is checked against the chart. Met, unmet, or undocumented — each one cites the exact line it came from.",
  },
  {
    n: "05",
    title: "A verdict, with its reasoning",
    body: "APPROVE, DENY, or REFER. Low-confidence cases route to a human reviewer instead of guessing. Nothing auto-submits behind your back.",
  },
  {
    n: "06",
    title: "Prepared, reviewed, appealed",
    body: "Prepare the packet for review and draft an appeal from the same evidence. Live payer submission requires an external integration.",
  },
] as const;

/** Cancer programs the oncology stack ships policy coverage for. */
export const DOMAINS = [
  { key: "breast",      label: "Breast" },
  { key: "lung",        label: "Lung (NSCLC)" },
  { key: "colorectal",  label: "Colorectal" },
  { key: "lymphoma",    label: "Lymphoma" },
  { key: "myeloma",     label: "Multiple myeloma" },
  { key: "melanoma",    label: "Melanoma" },
  { key: "prostate",    label: "Prostate" },
  { key: "ovarian",     label: "Ovarian" },
] as const;

/** Compliance posture — status strings are deliberately honest, not aspirational. */
export const COMPLIANCE_MARKS = [
  { label: "Privacy controls", status: "deployment review required" },
  { label: "CMS-0057-F",    status: "8 clauses tracked" },
  { label: "SOC 2 Type II",  status: "not independently attested" },
  { label: "Audit trail",    status: "every case event" },
] as const;
