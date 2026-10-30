import animate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

// `glass:` öneki yalnız Liquid Glass görünümünde geçerli sınıflar yazmayı sağlar (dark: gibi).
const glassVariant = plugin(({ addVariant }) => addVariant("glass", '[data-style="glass"] &'));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Latin ve Türkçe için Geist; Arapça glifler Noto Sans Arabic'e, Çince sistem fontlarına düşer.
      fontFamily: {
        sans: ["\"Geist Variable\"", "\"Noto Sans Arabic Variable\"", "ui-sans-serif", "system-ui", "-apple-system", "\"Segoe UI\"", "\"PingFang SC\"", "\"Microsoft YaHei\"", "sans-serif"],
        mono: ["\"Geist Mono Variable\"", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        brand: { DEFAULT: "hsl(var(--brand))", foreground: "hsl(var(--brand-foreground))", ink: "hsl(var(--brand-ink))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        chart: { 1: "hsl(var(--chart-1))", 2: "hsl(var(--chart-2))", 3: "hsl(var(--chart-3))", 4: "hsl(var(--chart-4))", 5: "hsl(var(--chart-5))" },
      },
    },
  },
  plugins: [animate, glassVariant],
};
