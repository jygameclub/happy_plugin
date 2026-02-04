import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name + '.js';
        },
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].[ext]';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest
        copyFileSync('src/manifest.json', 'dist/manifest.json');

        // Copy icons
        mkdirSync('dist/icons', { recursive: true });
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach((icon) => {
          try {
            copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
          } catch {
            console.warn(`Icon ${icon} not found, skipping`);
          }
        });
      },
    },
  ],
});
