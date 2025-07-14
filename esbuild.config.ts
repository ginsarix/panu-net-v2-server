import * as esbuild from 'esbuild';

esbuild
  .build({
    entryPoints: ['./src/index.ts'],
    outfile: './dist/bundle.js',
    bundle: true,
    platform: 'node',
    target: 'esnext',
    format: 'esm',
    external: ['aws-sdk', 'mock-aws-s3', 'nock', '@mapbox/node-pre-gyp'],
    sourcemap: true,
    minify: false, // reminder for future set this to true on prod
  })
  .then(() => {
    console.log('Build succeeded');
  })
  .catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });
