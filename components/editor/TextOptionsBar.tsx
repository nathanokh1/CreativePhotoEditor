"use client";

import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/components/ui/cn";

const FONTS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "System Sans", value: "system-ui, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Comic Sans", value: "'Comic Sans MS', cursive" },
  { label: "Impact", value: "Impact, sans-serif" },
];

type Align = "left" | "center" | "right";

/** Options bar for editing the active text layer. */
export function TextOptionsBar() {
  const layers = useEditor((s) => s.layers);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const updateTextLayer = useEditor((s) => s.updateTextLayer);
  const active = layers.find((l) => l.id === activeLayerId);

  const [text, setText] = useState("Text");
  const [fontSize, setFontSize] = useState(48);
  const [fillColor, setFillColor] = useState("#ffffff");
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<Align>("left");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [shadowColor, setShadowColor] = useState("#000000");
  const [shadowBlur, setShadowBlur] = useState(0);

  const activeType = active?.type;
  const activeText = active?.text;
  const activeFontSize = active?.fontSize;
  const activeFillColor = active?.fillColor;
  const activeFontFamily = active?.fontFamily;
  const activeBold = active?.bold;
  const activeItalic = active?.italic;
  const activeAlign = active?.align;
  const activeStrokeColor = active?.strokeColor;
  const activeStrokeWidth = active?.strokeWidth;
  const activeShadowColor = active?.shadowColor;
  const activeShadowBlur = active?.shadowBlur;

  useEffect(() => {
    if (activeType !== "text") return;
    setText(activeText ?? "Text");
    setFontSize(activeFontSize ?? 48);
    setFillColor(activeFillColor ?? "#ffffff");
    setFontFamily(activeFontFamily ?? "Inter, sans-serif");
    setBold(!!activeBold);
    setItalic(!!activeItalic);
    setAlign((activeAlign as Align) ?? "left");
    setStrokeColor(activeStrokeColor || "#000000");
    setStrokeWidth(activeStrokeWidth ?? 0);
    setShadowColor(activeShadowColor || "#000000");
    setShadowBlur(activeShadowBlur ?? 0);
  }, [
    activeType,
    activeText,
    activeFontSize,
    activeFillColor,
    activeFontFamily,
    activeBold,
    activeItalic,
    activeAlign,
    activeStrokeColor,
    activeStrokeWidth,
    activeShadowColor,
    activeShadowBlur,
  ]);

  if (!active || active.type !== "text") return null;

  const commit = (patch: Parameters<typeof updateTextLayer>[0]) => {
    void updateTextLayer(patch);
  };

  const strokeOn = strokeWidth > 0;
  const shadowOn = shadowBlur > 0;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[min(94vw,860px)] flex-wrap items-center gap-2.5 rounded-xl border border-panel-border bg-panel/95 px-3 py-2 shadow-panel backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit({ text })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Type your text…"
          className="min-w-[9rem] flex-1 rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-sm text-ink outline-none focus:border-accent/60"
        />

        <select
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            commit({ fontFamily: e.target.value });
          }}
          className="rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-xs text-ink outline-none focus:border-accent/60"
          style={{ fontFamily }}
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <ToggleBtn active={bold} label="Bold" onClick={() => { const v = !bold; setBold(v); commit({ bold: v }); }}>
            <Bold size={14} />
          </ToggleBtn>
          <ToggleBtn active={italic} label="Italic" onClick={() => { const v = !italic; setItalic(v); commit({ italic: v }); }}>
            <Italic size={14} />
          </ToggleBtn>
        </div>

        <div className="flex items-center gap-1">
          {(["left", "center", "right"] as Align[]).map((a) => (
            <ToggleBtn
              key={a}
              active={align === a}
              label={`Align ${a}`}
              onClick={() => {
                setAlign(a);
                commit({ align: a });
              }}
            >
              {a === "left" ? <AlignLeft size={14} /> : a === "center" ? <AlignCenter size={14} /> : <AlignRight size={14} />}
            </ToggleBtn>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink-dim" title="Fill color">
          <span className="text-[10px] text-ink-faint">Fill</span>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => {
              setFillColor(e.target.value);
              commit({ fillColor: e.target.value });
            }}
            className="h-6 w-7 cursor-pointer rounded border border-panel-border bg-transparent"
          />
        </label>

        <div className="w-24">
          <div className="mb-0.5 flex justify-between text-[10px] text-ink-faint">
            <span>Size</span>
            <span>{fontSize}px</span>
          </div>
          <Slider min={8} max={300} step={1} value={fontSize} onChange={setFontSize} onCommit={(v) => commit({ fontSize: v })} />
        </div>

        <div className="flex items-center gap-1.5">
          <ToggleBtn
            active={strokeOn}
            label="Toggle outline"
            onClick={() => {
              const v = strokeOn ? 0 : 3;
              setStrokeWidth(v);
              commit({ strokeWidth: v, strokeColor });
            }}
          >
            <span className="text-[10px] font-semibold">Outline</span>
          </ToggleBtn>
          {strokeOn && (
            <>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => {
                  setStrokeColor(e.target.value);
                  commit({ strokeColor: e.target.value });
                }}
                className="h-6 w-7 cursor-pointer rounded border border-panel-border bg-transparent"
                title="Outline color"
              />
              <div className="w-16">
                <div className="mb-0.5 text-right text-[10px] text-ink-faint">{strokeWidth}px</div>
                <Slider min={1} max={24} step={1} value={strokeWidth} onChange={setStrokeWidth} onCommit={(v) => commit({ strokeWidth: v })} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <ToggleBtn
            active={shadowOn}
            label="Toggle shadow"
            onClick={() => {
              const v = shadowOn ? 0 : 6;
              setShadowBlur(v);
              commit({ shadowBlur: v, shadowColor });
            }}
          >
            <span className="text-[10px] font-semibold">Shadow</span>
          </ToggleBtn>
          {shadowOn && (
            <>
              <input
                type="color"
                value={shadowColor}
                onChange={(e) => {
                  setShadowColor(e.target.value);
                  commit({ shadowColor: e.target.value });
                }}
                className="h-6 w-7 cursor-pointer rounded border border-panel-border bg-transparent"
                title="Shadow color"
              />
              <div className="w-16">
                <div className="mb-0.5 text-right text-[10px] text-ink-faint">{shadowBlur}px</div>
                <Slider min={1} max={40} step={1} value={shadowBlur} onChange={setShadowBlur} onCommit={(v) => commit({ shadowBlur: v })} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-ink-dim transition-colors",
        active
          ? "border-accent/60 bg-accent/15 text-ink"
          : "border-panel-border bg-panel-sunken hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
