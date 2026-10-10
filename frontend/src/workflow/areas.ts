export const areas = [
  {
    path: "/intake-tools",
    label: "Patient Intake",
    summary: "Choose how to bring patient clinical evidence into the cardiology clinic.",
    links: [
      ["New Patient Case / Scan", "/intake"],
      ["Bulk Patient Import", "/cases/bulk-import"],
      ["Import Historical Evidence", "/journey"],
    ],
  },
  {
    path: "/evidence",
    label: "Evidence Sources",
    summary: "Explore source observations and their traceable evidence.",
    links: [
      ["Environmental Overview", "/aquahealth"],
      ["New Observation", "/aquahealth/observations/new"],
      ["Observations", "/aquahealth/observations"],
      ["Map", "/aquahealth/map"],
      ["Trends", "/aquahealth/trends"],
      ["One Health", "/aquahealth/one-health"],
      ["Community", "/aquahealth/community"],
      ["Evidence Workbench / Passport", "/onehealth"],
    ],
  },
  {
    path: "/interop",
    label: "Interoperability",
    summary: "The data exchange home: review meaning, validate, and exchange cardiology records.",
    links: [
      ["Track 7 Exchange Workbench", "/interop"],
      ["Context Explorer (synthetic, optional)", "/oah-bridge"],
      ["Evidence Journey and Passport", "/journey"],
    ],
  },
  {
    path: "/review",
    label: "Review & Safety",
    summary: "Review queue for pending cardiology assessments.",
    links: [
      ["Environmental Review Queue", "/aquahealth/review"],
      ["Safety Evaluation", "/aquahealth/evaluation"],
      ["Clinical Reviewer Queue", "/reviewer"],
      ["Mapping Review", "/journey"],
    ],
  },
  {
    path: "/clinical-context",
    label: "Cardiac Assessment",
    summary:
      "Core cardiovascular diagnostics and digital twin integration.",
    links: [
      ["CardioTwin 3D Heart", "/cardiotwin"],
      ["Hemodynamic Twin", "/cardiotwin/hemo"],
      ["Cardiovascular Intelligence", "/cardiotwin/intelligence"],
      ["CardioTwin Atlas", "/cardiotwin/atlas"],
      ["CardioTwin Evaluation", "/cardiotwin/evaluation"],
      ["Oncology Module", "/onco"],
      ["General Case Context", "/cases"],
      ["AI Agents", "/agents"],
      ["Policies", "/policies"],
      ["Sandbox", "/sandbox"],
      ["OncoTwin", "/twin"],
      ["Guided Twin Demo", "/twin/demo"],
      ["Twin Overview", "/twin/overview"],
      ["SMART on FHIR EHR Launch", "/smart-on-fhir"],
    ],
  },
  {
    path: "/follow-up",
    label: "Follow-up & Retest",
    summary:
      "Return to the evidence workbench to review follow-up tasks and retest cardiac evidence.",
    links: [
      ["Follow-up / Retest Workbench", "/onehealth"],
      ["Notification Preferences", "/notifications"],
      ["Continue without a twin", "/journey"],
      ["Patient Registry", "/cases"],
    ],
  },
  {
    path: "/research",
    label: "Digital Twin Lab & Research",
    summary: "Choose a supporting research, cohort, or evaluation capability.",
    links: [
      ["Twin Research Lab", "/twin/lab"],
      ["Twin Operations", "/twin/ops"],
      ["Cohorts / Insights", "/cohorts"],
      ["Evaluation Harness", "/eval"],
      ["ROI & Value", "/roi"],
      ["Compliance", "/compliance"],
      ["Industrialization", "/industrialize"],
    ],
  },
] as const;

export function areaFor(path: string) {
  const exact = areas.find((a) => a.path === path);
  if (exact) return exact;
  return areas
    .flatMap((area) => area.links.map(([, href]) => ({ area, href })))
    .filter(({ href }) => path === href || path.startsWith(href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.area;
}
