import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6ec",
          100: "#f9e8cf",
          200: "#f2cf9d",
          300: "#eab163",
          400: "#e29438",
          500: "#d97706",
          600: "#b95f04",
          700: "#944705",
          800: "#76370a",
          900: "#60300c",
        },
      },
    },
  },
  plugins: [],
};

export default config;