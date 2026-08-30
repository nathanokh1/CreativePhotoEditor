"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
 * Renders as editor chrome (outside the canvas), not as an overlay on the image.
 */
export function OriOpsHandoff() {
  const ready = useEditor((s) => s.ready);
  const importFromUrl = useEditor((s) => s.importFromUrl);
  const engine = useEditor((s) => s.engine);
  const [params, setParams] = useState<OriOpsParams | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const importStarted = useRef(false);

  useEffect(() => {
    setParams(readParams());
  }, []);

  useEffect(() => {
    if (!ready || !params || importStarted.current) return;
    importStarted.current = true;
    void (async () => {
      try {
        await importFromUrl(params.src);
        setLoaded(true);
        setMsg("Loaded from ori-ops — crop / light adjust, then Send to ori-ops.");
      } catch (e) {
        importStarted.current = false;
        setMsg(e instanceof Error ? e.message : "Failed to load image");
      }
    })();
  }, [ready, params, importFromUrl]);

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

  if (collapsed) {
    return (
      <div className="flex h-9 shrink-0 items-center justify-end gap-2 border-b border-accent/30 bg-panel px-3">
        <button
          type="button"
          disabled={busy || !loaded}
          onClick={() => void send()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send to ori-ops"}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-[11px] text-ink-dim hover:text-ink"
        >
          Show handoff
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-accent/40 bg-panel px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-ink-dim">{msg || "ori-ops handoff"}</p>
      <button
        type="button"
        disabled={busy || !loaded}
        onClick={() => void send()}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send to ori-ops"}
      </button>
      <button
        type="button"
        aria-label="Hide ori-ops bar"
        title="Hide bar (Send stays available)"
        onClick={() => setCollapsed(true)}
        className="shrink-0 rounded-md p-1 text-ink-dim hover:bg-panel-sunken hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
