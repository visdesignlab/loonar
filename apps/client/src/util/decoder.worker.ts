// Modified from https://github.com/hms-dbmi/viv

import { getDecoder, addDecoder } from 'geotiff';
import ZstdDecoder from './zstd-decoder';

addDecoder(50000, () => ZstdDecoder);

// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

worker.addEventListener('message', async (e) => {
    // @ts-expect-error - FIXME: we should have strict types
    const { id, fileDirectory, buffer } = e.data;
    const decoder = await getDecoder(fileDirectory);
    const decoded = await decoder.decode(fileDirectory, buffer);
    worker.postMessage({ decoded, id }, [decoded]);
});
