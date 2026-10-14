/**
 * Intelligence Hub client: the absorbed cardiovascular projects served by /api/v1/hub.
 * Every call carries the signed-in user's bearer token.
 */
import { authHeader } from "../lib/core__src_lib__auth";

export interface HubCounts {
  files: number;
  images: number;
  models3d: number;
  datasets: number;
  notebooks: number;
  ml_models: number;
  metrics: number;
  features: number;
}

export interface HubModuleSummary {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  tech: string[];
  hero_image: string | null;
  live_app: boolean;
  features: string[];
  counts: HubCounts;
}

export interface HubFile {
  path: string;
  name: string;
  size: number;
  format?: string;
}

export interface HubMetric {
  name: string;
  value: number;
  source: string;
}

export interface HubModuleDetail extends HubModuleSummary {
  readme: string;
  readme_path: string | null;
  images: HubFile[];
  models3d: HubFile[];
  datasets: HubFile[];
  notebooks: HubFile[];
  ml_models: HubFile[];
  metrics: HubMetric[];
  run_commands: string[];
  languages: Record<string, number>;
}

export interface HubOverview {
  modules: number;
  files: number;
  images: number;
  models3d: number;
  datasets: number;
  notebooks: number;
  ml_models: number;
  metrics: number;
  live_apps: number;
  categories: Record<string, number>;
  tech: Record<string, number>;
}

export interface HubDatasetPreview {
  path: string;
  columns: string[];
  rows: string[][];
  total_rows: number;
}

const BASE = "/api/v1/hub";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: authHeader() });
  if (!response.ok) {
    throw new Error(`Hub request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export const hubApi = {
  overview: () => getJson<HubOverview>("/overview"),
  modules: () => getJson<HubModuleSummary[]>("/modules"),
  module: (slug: string) => getJson<HubModuleDetail>(`/modules/${encodeURIComponent(slug)}`),
  dataset: (slug: string, path: string, rows = 25) =>
    getJson<HubDatasetPreview>(`/modules/${encodeURIComponent(slug)}/datasets/${encodePath(path)}?rows=${rows}`),
  fileUrl: (slug: string, path: string) => `${BASE}/modules/${encodeURIComponent(slug)}/files/${encodePath(path)}`,
  /** Public static bundle of a module's own web app (trailing slash keeps relative assets working). */
  liveAppUrl: (slug: string) => `${BASE}/apps/${encodeURIComponent(slug)}/`,
};

/** Best headline metric of a module: discrimination first, then accuracy-style scores. */
/**
 * The one metric that best summarises a project, comparable across projects: ROC-AUC for the
 * overall CAD target first, then a mean ROC-AUC, then any ROC-AUC, then balanced accuracy.
 * PR-AUC is excluded (it depends on prevalence), and ties keep the project's own file order
 * rather than taking the highest value, so no project's best split is cherry-picked.
 */
export function headlineMetric(metrics: HubMetric[]): HubMetric | null {
  const rank = (m: HubMetric) => {
    const n = m.name.toLowerCase();
    const rocAuc = /(roc_auc|auroc|(^|[._])auc($|[._]|_mean))/.test(n) && !/(pr_auc|average_precision|prauc)/.test(n);
    if (/(^|[._])(min|max|std|threshold|ci_low|ci_high|lower|upper)/.test(n)) return 9;
    if (rocAuc && /(^|[._])(cad|cath|overall)([._]|$)/.test(n)) return 0;
    if (rocAuc && /mean/.test(n)) return 1;
    if (rocAuc) return 2;
    if (/balanced_accuracy/.test(n)) return 3;
    if (/accuracy|f1/.test(n)) return 4;
    return 9;
  };
  const usable = metrics.filter((m) => m.value >= 0 && m.value <= 1 && rank(m) < 9);
  return [...usable].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
