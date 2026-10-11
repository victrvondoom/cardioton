import { Droplets, FolderOpen, Globe2, HeartPulse, LayoutDashboard, Microscope, Network, Server, Settings, ShieldCheck, Stethoscope, Trophy, Upload, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WorkspaceLink {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  liveBadge?: "cases" | "awaitingReview";
  adminOnly?: boolean;
  /** Visibility is unchanged: the route itself enforces reviewer permissions. */
  reviewerOrAdmin?: boolean;
  end?: boolean;
}

export interface Workspace {
  id: string;
  label: string;
  href: string;
  summary: string;
  icon: LucideIcon;
  links: readonly WorkspaceLink[];
}

/** One navigation inventory shared by the sidebar, mobile menu and workspace bar.
 * Existing tools remain individual routes; grouping only changes their presentation. */
export const WORKSPACES: readonly Workspace[] = [
  {
    id: "clinic", label: "Clinic", href: "/dashboard", icon: LayoutDashboard,
    summary: "Clinic overview and the connected clinical journey.",
    links: [
      { label: "Clinic Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Clinical Journey", href: "/journey", icon: Workflow },
      { label: "Track 7 Overview", href: "/track7", icon: Network },
    ],
  },
  {
    id: "patients", label: "Patients", href: "/cases", icon: FolderOpen,
    summary: "Registry, intake, patient context and follow-up in one place.",
    links: [
      { label: "Patient Registry", href: "/cases", icon: FolderOpen, liveBadge: "cases", end: true },
      { label: "Clinical Intake", href: "/intake-tools", icon: Upload },
      { label: "New Patient Case", href: "/intake", icon: Stethoscope },
      { label: "Bulk Patient Import", href: "/cases/bulk-import", icon: Upload },
      { label: "Clinical Context", href: "/clinical-context", icon: Stethoscope },
      { label: "Follow-up & Retest", href: "/follow-up", icon: HeartPulse },
      { label: "Notification Preferences", href: "/notifications", icon: Settings },
      { label: "SMART on FHIR EHR Launch", href: "/smart-on-fhir", icon: Network },
    ],
  },
  {
    id: "cardiology", label: "Cardiology", href: "/cardiotwin", icon: HeartPulse,
    summary: "Heart anatomy, hemodynamics, intelligence and the evidence atlas.",
    links: [
      { label: "CardioTwin 3D Heart", href: "/cardiotwin", icon: HeartPulse, end: true, description: "Live vessel-level CAD prediction and 3D heart" },
      { label: "Hemodynamic Twin", href: "/cardiotwin/hemo", icon: HeartPulse, description: "Heart-failure evidence, hemodynamic transitions" },
      { label: "Cardiovascular Evidence", href: "/cardiotwin/intelligence", icon: HeartPulse, description: "Anatomic upload, reviewed evidence replay" },
      { label: "CardioTwin Atlas", href: "/cardiotwin/atlas", icon: HeartPulse, description: "Multimodal evidence graph and spatial replay" },
      { label: "Global Evidence", href: "/cardiotwin/global", icon: Network },
      { label: "Evaluation & Methods", href: "/cardiotwin/evaluation", icon: Microscope },
      { label: "IIT Mandi Track A Demo", href: "/iit-mandi", icon: Trophy, description: "Complete cardiovascular risk visualization & prediction demonstration" },
      { label: "CROSS-5 Studio", href: "/cross5", icon: Globe2, description: "Five-frame multiscale intersection engine (Heart × Earth × Flow × Chronos × City)" },
    ],
  },
  {
    id: "evidence", label: "Evidence & Exchange", href: "/onehealth", icon: Droplets,
    summary: "Source evidence, human review and interoperable exchange.",
    links: [
      { label: "Evidence Workbench", href: "/onehealth", icon: Droplets },
      { label: "Interoperability", href: "/interop", icon: Network },
      { label: "Reviewer Queue", href: "/review", icon: ShieldCheck, liveBadge: "awaitingReview" },
      { label: "Evidence Sources", href: "/evidence", icon: Droplets },
      { label: "Environmental Overview", href: "/aquahealth", icon: Droplets },
      { label: "New Observation", href: "/aquahealth/observations/new", icon: Upload },
      { label: "Observations", href: "/aquahealth/observations", icon: Droplets },
      { label: "Evidence Map", href: "/aquahealth/map", icon: Network },
      { label: "Evidence Trends", href: "/aquahealth/trends", icon: LayoutDashboard },
      { label: "One Health", href: "/aquahealth/one-health", icon: HeartPulse },
      { label: "Community", href: "/aquahealth/community", icon: Network },
      { label: "Environmental Review Queue", href: "/aquahealth/review", icon: ShieldCheck, reviewerOrAdmin: true },
      { label: "Safety Evaluation", href: "/aquahealth/evaluation", icon: Microscope },
      { label: "Clinical Reviewer Queue", href: "/reviewer", icon: ShieldCheck, reviewerOrAdmin: true },
      { label: "Context Explorer", href: "/oah-bridge", icon: Network },
    ],
  },
  {
    id: "research", label: "Research & AI", href: "/research", icon: Microscope,
    summary: "AI, specialist modules, digital twin research and cohort tools.",
    links: [
      { label: "Research Overview", href: "/research", icon: Microscope },
      { label: "AI Agent Console", href: "/agents", icon: Network },
      { label: "Oncology Module", href: "/onco", icon: Microscope },
      { label: "Policy Engine", href: "/policies", icon: ShieldCheck },
      { label: "Clinical Sandbox", href: "/sandbox", icon: Microscope },
      { label: "OncoTwin", href: "/twin", icon: HeartPulse, end: true },
      { label: "Twin Overview", href: "/twin/overview", icon: HeartPulse },
      { label: "Guided Twin Demo", href: "/twin/demo", icon: HeartPulse },
      { label: "Classic Twin Demo", href: "/twin/demo/classic", icon: HeartPulse },
      { label: "Research Lab", href: "/twin/lab", icon: Microscope },
      { label: "Twin Operations", href: "/twin/ops", icon: Server },
      { label: "Cohort Analysis", href: "/cohorts", icon: Microscope },
    ],
  },
  {
    id: "administration", label: "Administration", href: "/runtime", icon: Settings,
    summary: "System health, compliance, value and platform settings.",
    links: [
      { label: "System Health", href: "/runtime", icon: Server },
      { label: "Compliance", href: "/compliance", icon: ShieldCheck },
      { label: "ROI & Value", href: "/roi", icon: LayoutDashboard },
      { label: "Architecture", href: "/architecture", icon: Network },
      { label: "Evaluation", href: "/eval", icon: Microscope },
      { label: "Industrialization", href: "/industrialize", icon: Server },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

export function workspaceFor(pathname: string): Workspace | undefined {
  return WORKSPACES.flatMap((workspace) => workspace.links.map((link) => ({ workspace, href: link.href })))
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.workspace;
}

export function workspaceLinks(workspace: Workspace, role = "coordinator"): WorkspaceLink[] {
  return workspace.links.filter((link) => !link.adminOnly || role === "admin");
}

/** The one current tool, including nested patient records and replay sub-pages. */
export function workspaceLinkFor(pathname: string): WorkspaceLink | undefined {
  return workspaceFor(pathname)?.links
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
