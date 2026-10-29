import * as esbuild from 'esbuild';
import { rm, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');

await mkdir('dist', { recursive: true });

const extension = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: dev,
  minify: !dev,
  logLevel: 'info',
};

const webview = {
  entryPoints: ['webview/main.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.svg': 'text' },
  define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
  logLevel: 'info',
};

const css = {
  entryPoints: ['webview/styles.css'],
  bundle: true,
  outfile: 'dist/webview.css',
  minify: !dev,
  logLevel: 'info',
};

if (watch) {
  for (const cfg of [extension, webview, css]) {
    const ctx = await esbuild.context(cfg);
    await ctx.watch();
  }
  console.log('\nWatching extension + webview…');
} else {
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await Promise.all([esbuild.build(extension), esbuild.build(webview), esbuild.build(css)]);
  console.log('Build complete.');
}
