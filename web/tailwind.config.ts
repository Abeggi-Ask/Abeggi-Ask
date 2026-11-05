import type { Config } from "tailwindcss";

// Abeggi palette: warm paper, deep plum ink, marigold + coral accents.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "#FFF6E5", deep: "#F7E9CC", card: "#FFFDF8" },
        plum: { 950: "#1B1033", 900: "#2A1B4D", 700: "#4A3578", 500: "#7A66A8", 300: "#C9BEE0" },
        marigold: { 300: "#FFD27A", 400: "#FFC04D", 500: "#FFB020", 600: "#E89A00" },
        coral: { 400: "#FF8577", 500: "#FF6B5B", 600: "#E5503F" },
        leaf: { 100: "#DDF3E4", 600: "#1F8A4C" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pop: "0 6px 0 0 rgba(42,27,77,0.9)",
        soft: "0 10px 30px -12px rgba(42,27,77,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
