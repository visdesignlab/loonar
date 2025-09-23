import { defineStore } from 'pinia';

export const useConfigStore = defineStore('configStore', () => {
    const environment =
        import.meta.env.VITE_ENVIRONMENT !== undefined
            ? import.meta.env.VITE_ENVIRONMENT
            : 'production';
    const useHttp = import.meta.env.VITE_USE_HTTP?.toLowerCase() === 'true';
    const envServerUrl = import.meta.env.VITE_SERVER_URL;
    const envDataPort = import.meta.env.DATA_PORT;
    const envWSPort = import.meta.env.WS_PORT;

    let httpValue = 'http://';
    let wsValue = 'ws://';
    if (!useHttp) {
        httpValue = 'https://';
        wsValue = 'wss://';
    }

    // Used to retrieve static files hosted by data store (local or MinIO)
    const serverUrl = envDataPort
        ? `${httpValue}${envServerUrl}:${envDataPort}`
        : `${httpValue}${envServerUrl}`;

    const wsServerUrl = envWSPort
        ? `${httpValue}${envServerUrl}:${envWSPort}`
        : `${httpValue}${envServerUrl}`;

    // Location of websocket for DuckDb as specified in NGINX
    const duckDbWebSocketUrl = `${wsValue}${wsServerUrl.replace(
        '/data',
        '/ws/'
    )}`;
    const apiUrl = `${httpValue}${envServerUrl.replace('/data', '/api')}`;

    // Environment based location of data retrieval for DuckDb

    // let duckDbDataLocation =
    //     environment === 'local' ? 'data:9000' : 'minio:9000/data';
    const duckDbDataLocation = 'client/data';
    const duckDbUrl = `${httpValue}${duckDbDataLocation}`;
    const entryPointFilename = '/aa_index.json';

    function getFileUrl(path: string): string {
        // Trims any leading slashes from path
        const trimmedPath = path.replace(/^\/+/, '');
        return `${serverUrl}/${trimmedPath}`;
    }

    function getDuckDbFileUrl(path: string): string {
        // Trims any leading slashes from path
        const trimmedPath = path.replace(/^\/+/, '');
        return `${duckDbUrl}/${trimmedPath}`;
    }

    return {
        environment,
        useHttp,
        envServerUrl,
        serverUrl,
        duckDbWebSocketUrl,
        apiUrl,
        duckDbUrl,
        entryPointFilename,
        getFileUrl,
        getDuckDbFileUrl,
    };
});
