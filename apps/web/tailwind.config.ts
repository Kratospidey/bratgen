import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        brat: ["'Arial Narrow'", "Arial", "sans-serif"]
      },
      colors: {
        brat: "#CBFF00"
      }
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addUtilities }) => {
      addUtilities({
        ".text-outline": {
          textShadow:
            "0 0 2px rgba(0,0,0,0.75), 0 0 5px rgba(0,0,0,0.45), 0 0 10px rgba(0,0,0,0.25)"
        }
      });
    })
  ]
};

export default config;
