"use client";

import dynamic from "next/dynamic";

// The editor is browser-only (PixiJS/WebGL), so skip SSR entirely.
const EditorShell = dynamic(
  () => import("@/components/editor/EditorShell").then((m) => m.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] items-center justify-center bg-panel-sunken text-ink-dim">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-panel-border border-t-accent" />
          <p className="text-sm">Loading editor…</p>
        </div>
      </div>
    ),
  },
);

export default function EditorPage() {
  return <EditorShell />;
}
