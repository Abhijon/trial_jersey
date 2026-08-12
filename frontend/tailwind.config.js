/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#0B3D2E",
          dark: "#082A20",
          light: "#123524",
        },
        chalk: "#F5F5F0",
        gold: "#C9A227",
        charcoal: "#1A1A1A",
        claret: "#7A1F2B",
      },
      fontFamily: {
        display: ["'Anton'", "Impact", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};
