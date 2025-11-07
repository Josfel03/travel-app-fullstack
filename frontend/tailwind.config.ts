import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 👇 AQUÍ ESTÁ TU DISEÑO ANTIGUO 👇
      colors: {
        'brand-primary': '#1e3a8a',
        'brand-secondary': '#3b82f6',
        'brand-light-gray': '#f3f4f6',
        'brand-success': '#10b981',
        'brand-alert': '#ef4444',
        'brand-warning': '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Poppins', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
      },
      // 👆 HASTA AQUÍ 👆
    },
  },
  plugins: [],
}
export default config