import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'primary-dark': '#060A14',
        'surface-dark': '#1A202C',
        'text-light': '#E0E7FF',
        'accent-cool': '#79F8FF', // Cyan Glow
        'accent-hot': '#FF4757',  // Red Action
        'border-subtle': '#2D3748',
      },
      boxShadow: {
        'glow-cool': '0 0 20px rgba(121, 248, 255, 0.5)',
        'glow-hot': '0 0 20px rgba(255, 71, 87, 0.5)',
      },
    },
  },
  plugins: [],
};
export default config;
