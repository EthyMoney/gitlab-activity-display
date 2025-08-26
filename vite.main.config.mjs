import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.js',
      formats: ['cjs'],
      fileName: () => 'main.js'
    },
    rollupOptions: {
      external: ['electron', 'node:path', 'node-fetch', 'electron-squirrel-startup']
    },
    outDir: '.vite/build'
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'favicon.ico',
          dest: ''
        }
      ]
    })
  ]
});