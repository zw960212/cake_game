import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'game.js',
  format: 'iife',
  target: 'es2017',
  sourcemap: watch,
  minify: !watch,
  logLevel: 'info',
  loader: { '.json': 'json' },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ → game.js');
} else {
  await esbuild.build(options);
}
