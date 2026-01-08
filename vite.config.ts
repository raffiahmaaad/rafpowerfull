import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscatorPlugin from 'rollup-plugin-obfuscator';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      fs: {
        // Deny access to api folder (Vercel serverless functions)
        deny: ['api'],
      },
      watch: {
        ignored: ['**/api/**', '**/worker/**'],
      },
    },
    plugins: [react()],
    // Explicitly define env variables for build
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Expose VITE_API_URL for Vercel builds
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || env.VITE_API_URL || 'https://ghostmail-worker.rafxyz.workers.dev'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      exclude: ['api']
    },
    esbuild: {
      exclude: /api\/.*/,
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        mangle: {
          toplevel: true,
        },
      },
      rollupOptions: {
        // Exclude api folder from build
        external: [/^api\/.*/],
        plugins: isProd ? [
          obfuscatorPlugin({
            options: {
              compact: true,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              debugProtection: false,
              disableConsoleOutput: true,
              identifierNamesGenerator: 'hexadecimal',
              renameGlobals: false,
              rotateStringArray: true,
              selfDefending: false,
              stringArray: true,
              stringArrayEncoding: ['base64'],
              stringArrayThreshold: 0.75,
              unicodeEscapeSequence: false
            }
          })
        ] : [],
      },
      sourcemap: false, // Don't expose source maps in production
    },
  };
});
