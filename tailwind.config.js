/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        discord: {
          blurple: '#5865F2',
          green: '#57F287',
          yellow: '#FEE75C',
          fuchsia: '#EB459E',
          red: '#ED4245',
          white: '#FFFFFF',
          black: '#000000',
          dark: {
            1: '#202225',
            2: '#2F3136',
            3: '#36393F',
            4: '#40444B',
          },
          gray: {
            1: '#DCDDDE',
            2: '#B9BBBE',
            3: '#8E9297',
            4: '#72767D',
          },
        },
      },
    },
  },
  plugins: [],
}
