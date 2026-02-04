import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, rmSync, existsSync, renameSync } from 'fs';

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
        const distDir = resolve(__dirname, 'dist');

        // Move HTML files to dist root
        const htmlMoves = [
          { from: 'dist/src/popup/popup.html', to: 'dist/popup.html' },
          { from: 'dist/src/sidepanel/sidepanel.html', to: 'dist/sidepanel.html' },
        ];
        htmlMoves.forEach(({ from, to }) => {
          const srcPath = resolve(__dirname, from);
          const destPath = resolve(__dirname, to);
          if (existsSync(srcPath)) {
            renameSync(srcPath, destPath);
          }
        });

        // Remove the src folder from dist
        const srcFolder = resolve(distDir, 'src');
        if (existsSync(srcFolder)) {
          rmSync(srcFolder, { recursive: true });
        }

        // Copy manifest
        copyFileSync(
          resolve(__dirname, 'src/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );

        // Copy icons
        mkdirSync(resolve(__dirname, 'dist/icons'), { recursive: true });
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach((icon) => {
          try {
            copyFileSync(
              resolve(__dirname, `public/icons/${icon}`),
              resolve(__dirname, `dist/icons/${icon}`)
            );
          } catch {
            console.warn(`Icon ${icon} not found, skipping`);
          }
        });
      },
    },
  ],
});
