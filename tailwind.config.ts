import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./core/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Editor chrome palette — dark, modern, high-contrast.
        panel: {
          DEFAULT: "#181a1f",
          raised: "#1f2229",
          sunken: "#121317",
          border: "#2a2e37",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#7c7ff5",
          muted: "#4338ca",
        },
        ink: {
          DEFAULT: "#e7e9ee",
          dim: "#9aa0ac",
          faint: "#6b7280",
        },
      },
      boxShadow: {
        panel: "0 8px 30px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(99,102,241,0.4), 0 0 20px rgba(99,102,241,0.25)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
