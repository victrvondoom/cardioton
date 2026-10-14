import type { HemoSnapshot } from "../hemoTypes";

/** The reference mesh never supplies clinical evidence of its own. */
export interface AnatomyFinding {
  id: string;
  structure_id: string | null;
  label: string;
  review_status: "pending" | "approved" | "rejected" | "unsupported";
  source_excerpt?: string;
  source_ref?: string;
  observed_at?: string | null;
  available_at?: string | null;
  mapping_explanation?: string;
  certainty?: string;
  value?: number | null;
  unit?: string | null;
}

export type AnatomyMode = "anatomy" | "evidence" | "coronary" | "hemo" | "section" | "replay";

export interface AnatomyViewerProps {
  findings: AnatomyFinding[];
  selectedStructure?: string | null;
  onSelect: (structure: string) => void;
  mode?: AnatomyMode;
  snapshot?: HemoSnapshot | null;
  comparisonLabel?: string;
}

export interface ReferenceStructure {
  id: string;
  label: string;
  shortLabel: string;
  group: "Chambers" | "Interior" | "Great vessels" | "Coronaries";
  origin: "HRA reference mesh" | "Illustrative vessel overlay";
  description: string;
  ontology?: string;
}

export const REFERENCE_STRUCTURES: readonly ReferenceStructure[] = [
  { id: "LA", label: "Left atrium", shortLabel: "LA", group: "Chambers", origin: "HRA reference mesh", ontology: "UBERON:0002079", description: "Receives blood returning from the lungs. This is generic reference anatomy." },
  { id: "RA", label: "Right atrium", shortLabel: "RA", group: "Chambers", origin: "HRA reference mesh", ontology: "UBERON:0002078", description: "Receives blood returning from the body." },
  { id: "LV", label: "Left ventricle", shortLabel: "LV", group: "Chambers", origin: "HRA reference mesh", ontology: "UBERON:0002084", description: "Pumps blood into the systemic circulation. Reported LVEF provides functional context; the display motion does not simulate patient contractility." },
  { id: "RV", label: "Right ventricle", shortLabel: "RV", group: "Chambers", origin: "HRA reference mesh", ontology: "UBERON:0002080", description: "Pumps blood toward the lungs." },
  { id: "SEPTUM", label: "Interventricular septum", shortLabel: "Septum", group: "Interior", origin: "HRA reference mesh", ontology: "UBERON:0002094", description: "Muscular partition between the ventricles. Use cutaway or isolate to inspect it." },
  { id: "MITRAL", label: "Mitral valve", shortLabel: "Mitral", group: "Interior", origin: "HRA reference mesh", ontology: "UBERON:0002135", description: "Valve between the left atrium and left ventricle. Use cutaway or isolate to inspect it." },
  { id: "TRICUSPID", label: "Tricuspid valve", shortLabel: "Tricuspid", group: "Interior", origin: "HRA reference mesh", ontology: "UBERON:0002134", description: "Valve between the right atrium and right ventricle." },
  { id: "PULMONARY_VALVE", label: "Pulmonary valve", shortLabel: "Pulmonary valve", group: "Interior", origin: "HRA reference mesh", ontology: "UBERON:0002146", description: "Valve at the right ventricular outflow toward the pulmonary artery." },
  { id: "AORTIC_VALVE", label: "Aortic valve", shortLabel: "Aortic valve", group: "Interior", origin: "HRA reference mesh", ontology: "UBERON:0002137", description: "Valve at the left ventricular outflow toward the aorta." },
  { id: "AORTA", label: "Ascending aorta", shortLabel: "Aorta", group: "Great vessels", origin: "Illustrative vessel overlay", description: "Illustrative ascending aorta and arch context. Its shape is added in code, independently of reported findings." },
  { id: "PULMONARY_ARTERY", label: "Pulmonary arteries", shortLabel: "Pulmonary arteries", group: "Great vessels", origin: "Illustrative vessel overlay", description: "Illustrative outflow and branches toward the lungs. No pulmonary pressure or flow is simulated." },
  { id: "VENA_CAVA", label: "Venae cavae", shortLabel: "Venae cavae", group: "Great vessels", origin: "Illustrative vessel overlay", description: "Illustrative major systemic veins returning blood toward the right atrium." },
  { id: "PULMONARY_VEINS", label: "Pulmonary veins", shortLabel: "Pulmonary veins", group: "Great vessels", origin: "Illustrative vessel overlay", description: "Illustrative venous return from the lungs to the left atrium." },
  { id: "LAD", label: "Left anterior descending artery", shortLabel: "LAD", group: "Coronaries", origin: "Illustrative vessel overlay", description: "Illustrative artery following the anterior interventricular region. A reported stenosis percentage does not establish an exact lesion position or lumen shape." },
  { id: "LCX", label: "Left circumflex artery", shortLabel: "LCX", group: "Coronaries", origin: "Illustrative vessel overlay", description: "Illustrative coronary course toward the left atrioventricular region. Findings refer to the vessel unless a source establishes a segment." },
  { id: "RCA", label: "Right coronary artery", shortLabel: "RCA", group: "Coronaries", origin: "Illustrative vessel overlay", description: "Illustrative coronary course along the right atrioventricular region. No patient-specific vessel geometry is inferred." },
];

const ALIASES: Record<string, string> = {
  LEFT_ATRIUM: "LA", RIGHT_ATRIUM: "RA", LEFT_VENTRICLE: "LV", RIGHT_VENTRICLE: "RV",
  INTERVENTRICULAR_SEPTUM: "SEPTUM", MITRAL_VALVE: "MITRAL", TRICUSPID_VALVE: "TRICUSPID",
  ASCENDING_AORTA: "AORTA", PULMONARY_ARTERIES: "PULMONARY_ARTERY", MAJOR_VEINS: "VENA_CAVA",
  LEFT_ANTERIOR_DESCENDING: "LAD", LEFT_CIRCUMFLEX: "LCX", RIGHT_CORONARY: "RCA",
};

/** Unknown mappings stay unresolved; there is deliberately no general-heart fallback. */
export function normalizeStructureId(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().replace(/[ -]/g, "_").toUpperCase();
  const candidate = ALIASES[key] ?? key;
  return REFERENCE_STRUCTURES.some(structure => structure.id === candidate) ? candidate : null;
}

export function approvedStructureFindings(findings: AnatomyFinding[], id: string): AnatomyFinding[] {
  return findings.filter(finding => finding.review_status === "approved" && normalizeStructureId(finding.structure_id) === id);
}
