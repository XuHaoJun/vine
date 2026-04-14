import { tamaguiPlugin } from '@tamagui/vite-plugin'
import { one } from 'one/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import strip from '@rollup/plugin-strip'
import { createRequire } from 'node:module'
import path from 'node:path'

import type { UserConfig } from 'vite'

const _require = createRequire(import.meta.url)
const tamaguiToastV1 = path.join(
  path.dirname(_require.resolve('@tamagui/toast/package.json')),
  'dist/esm/v1.mjs',
)

export default {
  server: {
    allowedHosts: ['host.docker.internal'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/oauth2': 'http://localhost:3001',
      '/oa.v1.OAService': 'http://localhost:3001',
      '/greeter.v1.GreeterService': 'http://localhost:3001',
    },
  },

  optimizeDeps: {
    include: ['async-retry', 'pino', 'quick-format-unescaped'],
    exclude: ['oxc-parser'],
  },

  ssr: {
    noExternal: true,
    external: [
      'pino',
      'on-zero',
      '@vxrn/mdx',
      '@rocicorp/zero',
      'retext',
      'retext-smartypants',
      '@opentelemetry/api',
      '@opentelemetry/semantic-conventions',
      '@opentelemetry/sdk-trace-base',
      '@opentelemetry/sdk-trace-node',
      '@opentelemetry/core',
      '@opentelemetry/resources',
      '@opentelemetry/sdk-node',
    ],
  },

  define: {
    'process.env.LOG_LEVEL': JSON.stringify(
      process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
    ),
  },

  plugins: [
    tamaguiPlugin(),
    one({
      setupFile: {
        client: './src/setupClient.ts',
        server: './src/setupServer.ts',
        native: './src/setupNative.ts',
      },
      react: {
        compiler: process.env.NODE_ENV === 'production',
      },
      native: {
        bundler: 'rolldown',
      },
      router: {
        experimental: {
          typedRoutesGeneration: 'runtime',
        },
      },
      web: {
        experimental_scriptLoading: 'after-lcp-aggressive',
        inlineLayoutCSS: true,
        defaultRenderMode: 'spa',
        sitemap: {
          priority: 0.5,
          changefreq: 'weekly',
          exclude: [
            '/login/**',
            '/signup/**',
            '/profile-setup',
            '/avatar-setup',
            '/settings/**',
          ],
        },
      },
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          strip({
            functions: ['logger.debug', 'logger.trace'],
            include: ['**/*.{ts,tsx}'],
          }),
        ]
      : []),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'bundle_stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            emitFile: true,
          }),
          visualizer({
            filename: 'bundle_stats.json',
            template: 'raw-data',
            gzipSize: true,
            brotliSize: true,
            emitFile: true,
          }),
        ]
      : []),
  ],
} satisfies UserConfig
