import type { Config } from "tailwindcss";

// Cores semânticas via CSS variables (ver app/globals.css): o modo escuro troca
// só os valores das variáveis, sem precisar de `dark:` em cada classe nem de !important.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a6ff",
          500: "#3382fc",
          600: "#1d63eb",
          700: "#174fd8",
          800: "#193fae",
          900: "#193a89",
        },
        canvas: v("canvas"),
        surface: v("surface"),
        ink: {
          50: v("ink-50"),
          100: v("ink-100"),
          200: v("ink-200"),
          300: v("ink-300"),
          400: v("ink-400"),
          500: v("ink-500"),
          600: v("ink-600"),
          700: v("ink-700"),
          800: v("ink-800"),
          900: v("ink-900"),
        },
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 24 40 / .05)",
        pop: "0 16px 48px -16px rgb(16 24 40 / .35)",
      },
    },
  },
  plugins: [],
};
export default config;
