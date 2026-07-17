"use client";

import { Hand, Maximize, Move, Scaling, ZoomIn, ZoomOut } from "lucide-react";
import { ToolId } from "@/core";
import { useEditor } from "@/state/editor-store";
import { IconButton } from "@/components/ui/IconButton";

const TOOLS: {
  id: ToolId;
  label: string;
  description: string;
  shortcut: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "move",
    label: "Move",
    description: "Select a layer by clicking it, then drag to reposition. Hold Shift to lock to one axis.",
    shortcut: "V",
    icon: <Move size={18} />,
  },
  {
    id: "transform",
    label: "Transform",
    description: "Scale the active layer from its center by dragging outward or inward.",
    shortcut: "T",
    icon: <Scaling size={18} />,
  },
  {
    id: "hand",
    label: "Pan",
    description: "Drag to move around the canvas without affecting any layers.",
    shortcut: "H",
    icon: <Hand size={18} />,
  },
];

export function Toolbar() {
  const activeTool = useEditor((s) => s.activeTool);
  const setTool = useEditor((s) => s.setTool);
  const zoomIn = useEditor((s) => s.zoomIn);
  const zoomOut = useEditor((s) => s.zoomOut);
  const fitToView = useEditor((s) => s.fitToView);

  return (
    <div className="flex h-full w-14 flex-col items-center gap-1.5 border-r border-panel-border bg-panel py-3">
      {TOOLS.map((t) => (
        <IconButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          description={t.description}
          shortcut={t.shortcut}
          active={activeTool === t.id}
          onClick={() => setTool(t.id)}
        />
      ))}

      <div className="my-1.5 h-px w-7 bg-panel-border" />

      <IconButton icon={<ZoomIn size={18} />} label="Zoom in" description="Magnify the canvas view." shortcut="+" onClick={zoomIn} />
      <IconButton icon={<ZoomOut size={18} />} label="Zoom out" description="Shrink the canvas view." shortcut="-" onClick={zoomOut} />
      <IconButton icon={<Maximize size={18} />} label="Fit" description="Fit the whole document within the view." shortcut="0" onClick={fitToView} />
    </div>
  );
}
