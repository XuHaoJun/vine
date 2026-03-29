import { tamaguiPlugin } from '@tamagui/vite-plugin'
import { one } from 'one/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { createRequire } from 'node:module'
import path from 'node:path'

import type { UserConfig } from 'vite'

const _require = createRequire(import.meta.url)
const tamaguiToastV1 = path.join(
  path.dirname(_require.resolve('@tamagui/toast/package.json')),
  'dist/esm/v1.mjs',
)

export default {
  resolve: {
    alias: {
      // @tamagui/toast v2 moved the v1 API (ToastProvider, ToastViewport, useToastController,
      // useToastState) out of the main entry point. Alias back to the v1 submodule.
      '@tamagui/toast': tamaguiToastV1,
    },
  },

  server: {
    allowedHosts: ['host.docker.internal'],
  },

  optimizeDeps: {
    include: ['async-retry'],
    // @hot-updater/cli-tools contains native .node binaries (oxc-transform)
    // that esbuild can't handle - exclude from optimization
    exclude: ['@hot-updater/cli-tools', 'qrcode-terminal', 'oxc-parser'],
  },

  ssr: {
    // we set this as it generally improves compatability by optimizing all deps for node
    noExternal: true,
    // @rocicorp/zero must be external to prevent Symbol mismatch between
    // @rocicorp/zero and @rocicorp/zero/server - they share queryInternalsTag
    // Symbol that must be the same instance for query transforms to work
    external: ['@vxrn/mdx', '@rocicorp/zero', 'retext', 'retext-smartypants'],
  },

  plugins: [
    tamaguiPlugin(
      // see tamagui.build.ts for configuration
    ),

    one({
      // reanimated 4.2.x dev-only error false positive: _requiresAnimatedComponent getter
      // throws when any code calls Object.keys() on animated style (tamagui does this)
      // fixed in reanimated 4.3.0 (PR #8990) - remove this patch when upgrading
      // see: https://github.com/software-mansion/react-native-reanimated/issues/8799
      patches: {
        'react-native-reanimated': {
          'lib/module/hook/useAnimatedStyle.js': (contents) =>
            contents?.replace(
              /throw new ReanimatedError\(\s*'Perhaps you are trying to pass an animated style[^)]+\);/g,
              'return true;',
            ),
        },
        // fix: vxrn expo-plugin generates `exec {}` which fails on Gradle 9 / RN 0.83
        // Gradle 9 removed project.exec {} — use ExecOperations injection instead
        // remove when vxrn fixes this upstream
        vxrn: {
          'expo-plugin.cjs': (contents) =>
            contents
              ?.replace(
                /exec \{\s*\n\s+commandLine vxrnCli, "patch"\s*\n\s+\}/g,
                `injected.execOps.exec {\n                commandLine "node", vxrnCli, "patch"\n            }`,
              )
              .replace(
                'gradle.taskGraph.whenReady',
                `interface InjectedExecOps {\n    @Inject\n    ExecOperations getExecOps()\n}\n\ndef injected = objects.newInstance(InjectedExecOps)\n\ngradle.taskGraph.whenReady`,
              ),
        },
      },

      setupFile: {
        client: './src/setupClient.ts',
        native: './src/setupNative.ts',
        server: './src/setupServer.ts',
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
