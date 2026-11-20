import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const local = { host: '127.0.0.1', port: 5173, strictPort: true };
export default defineConfig({
  plugins: [react()],
  server: local,
  preview: local,
});
