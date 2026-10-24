import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  plugins:[react()],
  resolve:{alias:[{find:/^\.\/mobile$/,replacement:path.join(root,'src/production/native-runtime.tsx')}]},
  build:{outDir:'dist/production',emptyOutDir:true,rollupOptions:{input:path.join(root,'production.html'),output:{inlineDynamicImports:true}}},
});
