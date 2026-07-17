import Link from "next/link";
import {
  ArrowRight,
  Download,
  Github,
  Layers,
  MousePointer2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Layers size={20} />,
    title: "Real layers",
    body: "Stack images, reorder, toggle visibility, tune opacity and blend modes — Normal, Multiply, Screen, Overlay.",
  },
  {
    icon: <MousePointer2 size={20} />,
    title: "Move & transform",
    body: "Grab any layer, drag it around, and scale it from the center. Undo/redo on everything.",
  },
  {
    icon: <Save size={20} />,
    title: "Save projects",
    body: "Keep your layered work in a portable .cpe project file and reopen it anytime.",
  },
  {
    icon: <Download size={20} />,
    title: "Export anywhere",
    body: "Flatten to a clean PNG, JPG or WebP in one click, at full resolution.",
  },
];

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-panel-sunken text-ink">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-fuchsia-500 text-white shadow-glow">
            <Sparkles size={18} />
          </div>
          <span className="text-sm font-semibold">CreativePhotoEditor</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/nathanokh1/CreativePhotoEditor"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-ink-dim transition-colors hover:text-ink"
          >
            <Github size={16} /> GitHub
          </a>
          <Link
            href="/editor"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Open editor
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="flex flex-col items-center pb-16 pt-20 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-panel-border bg-panel-raised/60 px-4 py-1.5 text-xs text-ink-dim">
            <Wand2 size={13} className="text-accent" /> Free forever · runs in your browser
          </div>
          <h1 className="max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            The photo editor that respects
            <span className="bg-gradient-to-r from-accent to-fuchsia-400 bg-clip-text text-transparent">
              {" "}
              your time and your files
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-ink-dim">
            Layers, cut & paste, resize, blend modes and export — the 20% of Photoshop you actually
            use, with none of the price tag. Nothing to install. Your images never leave your device.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/editor"
              className="group flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              Start editing
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="text-sm text-ink-faint">No account. No upload. No watermark.</span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-panel-border bg-panel/60 p-5 transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-glow"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-base font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-dim">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-panel-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} CreativePhotoEditor — free & open source.</span>
          <span>Browser today · Windows, macOS & mobile coming soon.</span>
        </div>
      </footer>
    </div>
  );
}
