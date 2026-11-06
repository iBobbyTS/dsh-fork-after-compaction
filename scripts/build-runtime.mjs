import { build } from 'tsdown'
import { rmSync } from 'node:fs'

// Only this package's generated runtime directory is owned by this build.
rmSync('lib', { recursive: true, force: true })
await build({
  entry: ["src/index.ts"], outDir: 'lib', root: 'src', unbundle: true,
  platform: 'node', format: 'esm', outExtensions: () => ({ js: '.js' }), target: 'node22', sourcemap: true,
  clean: false, dts: false, deps: { neverBundle: [/.*/] },
})
await build({
 entry: ["src/client.ts"], outDir: 'lib', platform: 'browser', format: 'cjs',
 target: 'es2022', sourcemap: true, clean: false, dts: false,
 deps: { neverBundle: ["react", "react/jsx-runtime", "react-dom", "@deepseek-ai/dsh-client-ui-primitives"] },
 outputOptions: {
   entryFileNames: 'client.js',
   banner: 'window.__ModuleLoader__.load({ id: \"@local/dsh-fork-after-compaction\", factory: (require) => {',
   intro: 'var module = { exports: {} }; var exports = module.exports;',
   footer: 'return module.exports; } });',
 },
})
