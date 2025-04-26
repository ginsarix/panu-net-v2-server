import * as esbuild from 'esbuild';

esbuild.build({
    entryPoints: ['./src/index.ts'],
    outfile: './dist/bundle.js',
    bundle: true,
    platform: 'node',
    target: 'esnext',
    format: 'esm',
    outdir: 'dist',
    sourcemap: true,
    minify: false, // reminder for future set this to true on prod
    external: ['express'],
}).then(() => {
    console.log('Build succeeded');
}).catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});