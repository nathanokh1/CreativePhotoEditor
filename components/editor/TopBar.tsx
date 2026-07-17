"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileUp,
  FolderOpen,
  Image as ImageIcon,
  Redo2,
  Save,
  Settings,
  Undo2,
} from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/components/ui/cn";

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const importFiles = useEditor((s) => s.importFiles);
  const openProject = useEditor((s) => s.openProject);
  const saveProject = useEditor((s) => s.saveProject);
  const exportAs = useEditor((s) => s.exportAs);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const docName = useEditor((s) => s.docName);
  const zoom = useEditor((s) => s.zoom);
  const busy = useEditor((s) => s.busy);

  const importRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="flex h-14 items-center gap-2 border-b border-panel-border bg-panel px-3">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-fuchsia-500 text-white shadow-glow">
          <ImageIcon size={18} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">CreativePhotoEditor</p>
          <p className="-mt-0.5 text-[11px] text-ink-faint">{docName}</p>
        </div>
      </div>

      <div className="mx-1 h-7 w-px bg-panel-border" />

      <input
        ref={importRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={openRef}
        type="file"
        accept=".cpe,application/zip"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) void openProject(e.target.files[0]);
          e.target.value = "";
        }}
      />

      <IconButton
        icon={<FileUp size={18} />}
        label="Import image"
        description="Bring a PNG, JPG or WebP in as a new layer. You can also drag & drop onto the canvas."
        shortcut="I"
        tooltipSide="bottom"
        onClick={() => importRef.current?.click()}
      />
      <IconButton
        icon={<FolderOpen size={18} />}
        label="Open project"
        description="Open a saved .cpe project file, restoring all its layers and edits."
        tooltipSide="bottom"
        onClick={() => openRef.current?.click()}
      />
      <IconButton
        icon={<Save size={18} />}
        label="Save project"
        description="Save your work as a .cpe file you can reopen later with all layers intact."
        shortcut="Ctrl+S"
        tooltipSide="bottom"
        onClick={() => void saveProject()}
      />

      <div className="relative">
        <IconButton
          icon={<Download size={18} />}
          label="Export"
          description="Flatten all visible layers into a single image (PNG, JPG or WebP)."
          shortcut="Ctrl+E"
          tooltipSide="bottom"
          active={exportOpen}
          onClick={() => setExportOpen((v) => !v)}
        />
        {exportOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
            <div className="absolute left-0 top-12 z-30 w-40 animate-fade-in rounded-xl border border-panel-border bg-panel-raised p-1.5 shadow-panel">
              {(["png", "jpeg", "webp"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {
                    setExportOpen(false);
                    void exportAs(fmt);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-dim hover:bg-accent/15 hover:text-ink"
                >
                  <span className="uppercase">{fmt === "jpeg" ? "jpg" : fmt}</span>
                  <span className="text-[10px] text-ink-faint">flatten</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mx-1 h-7 w-px bg-panel-border" />

      <IconButton
        icon={<Undo2 size={18} />}
        label="Undo"
        description="Step backward through your edit history."
        shortcut="Ctrl+Z"
        tooltipSide="bottom"
        disabled={!canUndo}
        onClick={undo}
      />
      <IconButton
        icon={<Redo2 size={18} />}
        label="Redo"
        description="Step forward again after undoing."
        shortcut="Ctrl+Y"
        tooltipSide="bottom"
        disabled={!canRedo}
        onClick={redo}
      />

      <div className="ml-auto flex items-center gap-3">
        {busy && (
          <span className="animate-fade-in rounded-full border border-panel-border bg-panel-raised px-3 py-1 text-xs text-ink-dim">
            {busy}
          </span>
        )}
        <Tooltip label="Zoom level" description="Current canvas magnification." side="bottom">
          <span className="min-w-[3.5rem] rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-center text-xs tabular-nums text-ink-dim">
            {Math.round(zoom * 100)}%
          </span>
        </Tooltip>
        <IconButton
          icon={<Settings size={18} />}
          label="Settings"
          description="Toggle info tooltips, adjust hover delay, and more."
          tooltipSide="bottom"
          onClick={onOpenSettings}
          className={cn("bg-transparent")}
        />
      </div>
    </header>
  );
}
