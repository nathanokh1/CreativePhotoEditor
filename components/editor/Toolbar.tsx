"use client";

import { useState } from "react";
import {
  Circle,
  Crop,
  Eraser,
  Hand,
  Lasso,
  Maximize,
  Bandage,
  Move,
  Paintbrush,
  PenTool,
  Pencil,
  Scaling,
  Scissors,
  Stamp,
  Square,
  SquareDashedMousePointer,
  Type,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ToolId } from "@/core";
import { useEditor } from "@/state/editor-store";
import { IconButton } from "@/components/ui/IconButton";
import { AutoLayersDialog } from "./AutoLayersDialog";

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
    description: "Resize with corner/edge handles. Drag the circle above the box to rotate.",
    shortcut: "T",
    icon: <Scaling size={18} />,
  },
  {
    id: "select",
    label: "Select",
    description: "Drag a rectangle to select a region for Cut/Copy.",
    shortcut: "M",
    icon: <SquareDashedMousePointer size={18} />,
  },
  {
    id: "lasso",
    label: "Lasso",
    description: "Freeform selection. Cut/Copy use the path's bounding box.",
    shortcut: "L",
    icon: <Lasso size={18} />,
  },
  {
    id: "wand",
    label: "Magic wand",
    description: "Click to select pixels of the active layer by color. Shift adds, Alt subtracts. Then Copy/Cut/Delete/Fill. (W)",
    shortcut: "W",
    icon: <Wand2 size={18} />,
  },
  {
    id: "crop",
    label: "Crop",
    description: "Drag a rectangle and release to crop the whole document to that region.",
    shortcut: "C",
    icon: <Crop size={18} />,
  },
  {
    id: "brush",
    label: "Brush",
    description: "Paint soft strokes on the active layer. Adjust size/color in the options bar.",
    shortcut: "B",
    icon: <Paintbrush size={18} />,
  },
  {
    id: "pencil",
    label: "Pencil",
    description: "Hard pixel strokes on the active layer.",
    shortcut: "P",
    icon: <Pencil size={18} />,
  },
  {
    id: "eraser",
    label: "Eraser",
    description: "Erase pixels on the active layer.",
    shortcut: "E",
    icon: <Eraser size={18} />,
  },
  {
    id: "pen",
    label: "Pen",
    description: "Draw a bezier path point by point (drag for curves). Then stroke/fill it to a new layer or turn it into a selection.",
    shortcut: "N",
    icon: <PenTool size={18} />,
  },
  {
    id: "clone",
    label: "Clone stamp",
    description: "Alt/Option-click to set a source point, then drag to clone those pixels elsewhere.",
    shortcut: "K",
    icon: <Stamp size={18} />,
  },
  {
    id: "heal",
    label: "Cleanup / Heal",
    description: "Brush over a blemish or object to remove it — the area is filled from its surroundings. Like a magic eraser.",
    shortcut: "J",
    icon: <Bandage size={18} />,
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
  const addTextLayer = useEditor((s) => s.addTextLayer);
  const addShapeLayer = useEditor((s) => s.addShapeLayer);
  const addEmptyLayer = useEditor((s) => s.addEmptyLayer);
  const [sliceOpen, setSliceOpen] = useState(false);

  return (
    <div className="flex h-full w-14 flex-col items-center gap-1 overflow-y-auto border-r border-panel-border bg-panel py-2">
      <AutoLayersDialog open={sliceOpen} onClose={() => setSliceOpen(false)} />
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

      <div className="my-1 h-px w-7 shrink-0 bg-panel-border" />

      <IconButton
        icon={<Type size={18} />}
        label="Text layer"
        description="Add a new text layer to the document."
        onClick={() => void addTextLayer()}
      />
      <IconButton
        icon={<Square size={18} />}
        label="Rectangle"
        description="Add a filled rectangle shape layer."
        onClick={() => void addShapeLayer("rect")}
      />
      <IconButton
        icon={<Circle size={18} />}
        label="Ellipse"
        description="Add a filled ellipse shape layer."
        onClick={() => void addShapeLayer("ellipse")}
      />
      <IconButton
        icon={<SquareDashedMousePointer size={16} />}
        label="Empty layer"
        description="Add a blank transparent layer the size of the canvas."
        onClick={() => void addEmptyLayer()}
      />
      <IconButton
        icon={<Scissors size={18} />}
        label="Auto-Layers / Slice"
        description="Split the active layer into separate layers by detecting regions (e.g. a grid of cards) or an even grid. Runs on your device."
        onClick={() => setSliceOpen(true)}
      />

      <div className="my-1 h-px w-7 shrink-0 bg-panel-border" />

      <IconButton icon={<ZoomIn size={18} />} label="Zoom in" description="Magnify the canvas view." shortcut="+" onClick={zoomIn} />
      <IconButton icon={<ZoomOut size={18} />} label="Zoom out" description="Shrink the canvas view." shortcut="-" onClick={zoomOut} />
      <IconButton icon={<Maximize size={18} />} label="Fit" description="Fit the whole document within the view." shortcut="0" onClick={fitToView} />
    </div>
  );
}
