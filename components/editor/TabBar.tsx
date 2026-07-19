"use client";

import { Plus, X } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { cn } from "@/components/ui/cn";

/** Document tabs — each open project/canvas is a tab. Autosaved to the browser. */
export function TabBar() {
  const docs = useEditor((s) => s.docs);
  const activeDocId = useEditor((s) => s.activeDocId);
  const switchTab = useEditor((s) => s.switchTab);
  const closeTab = useEditor((s) => s.closeTab);
  const newTab = useEditor((s) => s.newTab);

  // With a single Untitled tab there's nothing to switch between yet — hide the
  // bar until a second document exists to keep the chrome minimal.
  if (docs.length <= 1) {
    return (
      <div className="flex h-9 items-center gap-1 border-b border-panel-border bg-panel px-2">
        {docs.map((d) => (
          <Tab
            key={d.id}
            name={d.name}
            active={d.id === activeDocId}
            onSelect={() => switchTab(d.id)}
            onClose={() => void closeTab(d.id)}
            closable={false}
          />
        ))}
        <NewTabButton onClick={() => void newTab()} />
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center gap-1 overflow-x-auto border-b border-panel-border bg-panel px-2">
      {docs.map((d) => (
        <Tab
          key={d.id}
          name={d.name}
          active={d.id === activeDocId}
          onSelect={() => switchTab(d.id)}
          onClose={() => void closeTab(d.id)}
          closable
        />
      ))}
      <NewTabButton onClick={() => void newTab()} />
    </div>
  );
}

function Tab({
  name,
  active,
  onSelect,
  onClose,
  closable,
}: {
  name: string;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  closable: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      onAuxClick={(e) => {
        if (e.button === 1 && closable) onClose();
      }}
      className={cn(
        "group flex h-7 max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs",
        active
          ? "border-accent/50 bg-accent/10 text-ink"
          : "border-transparent bg-panel-sunken text-ink-dim hover:text-ink",
      )}
    >
      <span className="truncate">{name || "Untitled"}</span>
      {closable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "rounded p-0.5 text-ink-faint hover:text-ink",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          aria-label={`Close ${name}`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function NewTabButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:bg-panel-sunken hover:text-ink"
      aria-label="New tab"
      title="New document tab"
    >
      <Plus size={15} />
    </button>
  );
}
