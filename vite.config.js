import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                // Forward AI-related requests to the local Node.js service during development.
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
});
