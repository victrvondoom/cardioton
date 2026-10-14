/**
 * Hub files are behind sign-in, but <img> tags and 3D loaders cannot send an Authorization
 * header. Fetch the file with the token and hand the element a short-lived blob URL instead.
 */
import { useEffect, useState } from "react";
import { authHeader } from "../lib/core__src_lib__auth";
import { hubApi } from "./hubApi";

export interface BlobState {
  url: string | null;
  error: string | null;
  loading: boolean;
}

const TEXT_LIKE = /\.(md|txt|json|csv|tsv)$/i;

/** Open a module file in a new tab. The tab is opened first so the browser does not treat it as a pop-up. */
export async function openHubFile(slug: string, path: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const response = await fetch(hubApi.fileUrl(slug, path), { headers: authHeader() });
    if (!response.ok) throw new Error(`File unavailable (${response.status})`);
    const blob = await response.blob();
    // Show text files inline instead of downloading them.
    const shown = TEXT_LIKE.test(path) ? new Blob([blob], { type: "text/plain;charset=utf-8" }) : blob;
    const url = URL.createObjectURL(shown);
    if (tab) tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    window.alert(error instanceof Error ? error.message : "File unavailable");
  }
}

export function useHubBlobUrl(slug: string | undefined, path: string | null | undefined): BlobState {
  const [state, setState] = useState<BlobState>({ url: null, error: null, loading: Boolean(slug && path) });

  useEffect(() => {
    if (!slug || !path) {
      setState({ url: null, error: null, loading: false });
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ url: null, error: null, loading: true });
    fetch(hubApi.fileUrl(slug, path), { headers: authHeader() })
      .then(async (response) => {
        if (!response.ok) throw new Error(`File unavailable (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ url: null, error: error instanceof Error ? error.message : "File unavailable", loading: false });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slug, path]);

  return state;
}
