import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Замени 'number-game' на название твоего GitHub репозитория
export default defineConfig({
  plugins: [react()],
  base: '/number-game/',
})
