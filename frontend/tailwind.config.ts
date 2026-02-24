import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101A2A",
        mist: "#F3F7FF",
        pulse: "#00A9A5",
        ember: "#F97316",
        sky: "#2563EB"
      },
      fontFamily: {
        heading: ["Sora", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
