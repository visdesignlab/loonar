// Modified from https://github.com/hms-dbmi/viv

import { getDecoder, addDecoder } from 'geotiff';
import ZstdDecoder from './zstd-decoder';

addDecoder(50000, () => ZstdDecoder);

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

interface WorkerData {
    id: number;
    fileDirectory: string;
    buffer: ArrayBuffer;
}

async function decodeBuffer(e: MessageEvent<WorkerData>): Promise<void> {
    try {
        const { id, fileDirectory, buffer } = e.data;
        const decoder = await getDecoder(fileDirectory);
        const decoded = await decoder.decode(fileDirectory, buffer);
        worker.postMessage({ decoded, id }, [decoded]);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Failed: ${error.message} at ${e.data.id}`);
        } else {
            console.error(`Failed: Generic Error at ${e.data.id}`);
        }
    }
}

worker.addEventListener('message', (event: Event) => {
    const messageEvent = event as MessageEvent;
    decodeBuffer(messageEvent).catch((error: Error) => {
        console.error(`Error during decompression: ${error.message}`);
    });
});
