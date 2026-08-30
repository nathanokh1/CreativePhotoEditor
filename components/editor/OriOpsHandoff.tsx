"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/state/editor-store";

type OriOpsParams = {
  src: string;
  assetId: string;
  token: string;
  returnUrl: string;
};

function readParams(): OriOpsParams | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const src = q.get("src");
  const assetId = q.get("oriOpsAssetId");
  const token = q.get("oriOpsToken");
  const returnUrl = q.get("oriOpsReturn");
  if (!src || !assetId || !token || !returnUrl) return null;
  return { src, assetId, token, returnUrl };
}

/**
 * When opened from ori-ops (?src=&oriOpsAssetId=&oriOpsToken=&oriOpsReturn=),
 * auto-load the image and offer "Send to ori-ops".
 */
export function OriOpsHandoff() {
  const ready = useEditor((s) => s.ready);
  const importFromUrl = useEditor((s) => s.importFromUrl);
  const engine = useEditor((s) => s.engine);
  const [params, setParams] = useState<OriOpsParams | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setParams(readParams());
  }, []);

  useEffect(() => {
    if (!ready || !params || loaded) return;
    let cancelled = false;
    void (async () => {
      try {
        await importFromUrl(params.src);
        if (!cancelled) {
          setLoaded(true);
          setMsg("Loaded from ori-ops — crop / light adjust, then Send to ori-ops.");
        }
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "Failed to load image");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, params, loaded, importFromUrl]);

  if (!params) return null;

  async function send() {
    if (!engine || !params) return;
    setBusy(true);
    setMsg("Sending to ori-ops…");
    try {
      const blob = await engine.exportBlob("jpeg", {
        quality: 0.92,
        scale: 1,
        background: "#ffffff",
      });
      const form = new FormData();
      form.append("file", blob, `ori-${params.assetId.slice(-6)}.jpg`);
      form.append("token", params.token);
      form.append("label", "CPE edit");
      form.append("activate", "true");

      const res = await fetch(params.returnUrl, {
        method: "POST",
        headers: { "x-ori-ops-token": params.token },
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setMsg(json.detail ?? json.error ?? `Upload failed (${res.status})`);
        return;
      }
      setMsg("Saved to ori-ops gallery. You can close this tab.");
      // Prefer closing if we were opened as a popup
      if (window.opener) {
        window.opener.postMessage(
          { type: "ori-ops-cpe-done", assetId: params.assetId },
          "*",
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center px-3">
      <div className="pointer-events-auto mt-2 flex max-w-xl flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-panel/95 px-3 py-2 shadow-panel backdrop-blur">
        <p className="text-xs text-ink-dim">{msg || "ori-ops handoff"}</p>
        <button
          type="button"
          disabled={busy || !loaded}
          onClick={() => void send()}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send to ori-ops"}
        </button>
      </div>
    </div>
  );
}
