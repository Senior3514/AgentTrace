import type { Config } from "tailwindcss";

// AgentTrace design tokens. Dark-first, security/observability palette.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0D10",
        surface: "#11161B",
        "surface-2": "#151C22",
        border: "#26313B",
        text: "#E8F0F7",
        muted: "#93A4B5",
        verified: "#2EE6A6",
        trace: "#3BA7FF",
        warning: "#F6B84C",
        critical: "#FF5C7A",
      },
      fontFamily: {
        sans: ["Inter Tight", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
