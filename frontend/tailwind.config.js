/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        paper: { DEFAULT: "#f8fafc", 2: "#f1f5f9", 3: "#ffffff" },
        ink: { DEFAULT: "#172033", 2: "#475569", 3: "#64748b" },
        signal: { DEFAULT: "#2563eb", dark: "#1d4ed8" },
      },
      borderRadius: { DEFAULT: "8px", sm: "6px", md: "10px", lg: "14px", xl: "18px", "2xl": "24px", full: "9999px" },
      boxShadow: { soft: "0 8px 30px rgba(15,23,42,.06)" },
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        "pulse-soft": { "0%, 100%": { opacity: "1" }, "50%": { opacity: ".6" } },
      },
      animation: { "fade-in": "fade-in .35s ease-out both", "slide-in-right": "slide-in-right .3s ease-out both", "pulse-soft": "pulse-soft 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
