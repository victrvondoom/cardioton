/** A module's README, rendered with its own images and file links resolved through the hub. */
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openHubFile, useHubBlobUrl } from "./hubAssets";

/** File types the hub serves (mirrors SERVABLE_EXTS in app/hub/module_catalog.py). */
const SERVABLE = /\.(png|jpe?g|gif|webp|svg|bmp|glb|gltf|stl|obj|ply|csv|tsv|json|md|txt|pdf)$/i;

function resolveRelative(baseDir: string, ref: string): string | null {
  if (/^(https?:|data:|mailto:|#)/i.test(ref)) return null;
  const clean = decodeURIComponent(ref.split("#")[0].split("?")[0]);
  const parts = (clean.startsWith("/") ? clean.slice(1) : `${baseDir ? `${baseDir}/` : ""}${clean}`).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

function ReadmeImage({ slug, baseDir, src, alt }: { slug: string; baseDir: string; src?: string; alt?: string }) {
  const local = src ? resolveRelative(baseDir, src) : null;
  const { url } = useHubBlobUrl(local ? slug : undefined, local);
  const finalSrc = local ? url : src;
  if (!finalSrc) return null;
  return <img src={finalSrc} alt={alt ?? ""} loading="lazy" />;
}

function ReadmeLink({ slug, baseDir, href, children }: { slug: string; baseDir: string; href?: string; children: ReactNode }) {
  if (href && /^(https?:|mailto:)/i.test(href)) {
    return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
  }
  const local = href ? resolveRelative(baseDir, href) : null;
  if (local && SERVABLE.test(local)) {
    return (
      <a href="#" title={local} onClick={(event) => { event.preventDefault(); void openHubFile(slug, local); }}>
        {children}
      </a>
    );
  }
  // In-page anchors and source files the hub does not serve: keep the text, drop the dead link.
  return <span className="text-sky-200/80" title={local ?? undefined}>{children}</span>;
}

export function HubMarkdown({ slug, markdown, readmePath }: { slug: string; markdown: string; readmePath: string | null }) {
  const baseDir = readmePath && readmePath.includes("/") ? readmePath.slice(0, readmePath.lastIndexOf("/")) : "";
  return (
    <div className="ci-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => <ReadmeImage slug={slug} baseDir={baseDir} src={typeof src === "string" ? src : undefined} alt={alt} />,
          a: ({ href, children }) => <ReadmeLink slug={slug} baseDir={baseDir} href={href}>{children}</ReadmeLink>,
          table: ({ children }) => <div className="ci-table-wrap"><table>{children}</table></div>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
