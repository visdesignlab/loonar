import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

import vue from '@vitejs/plugin-vue';

import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

export default defineConfig(({ command, mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');
    return {
        // vite config
        plugins: [
            vue(),

            quasar({
                sassVariables: 'src/quasar-variables.sass',
            }),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        define: {
            __APP_ENV__: JSON.stringify(env.APP_ENV),
        },
        worker: {
            format: 'es',
        },
    };
});
