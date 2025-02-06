import { BaseDecoder } from 'geotiff';
import { Zstd } from 'numcodecs';

export default class ZstdDecoder extends BaseDecoder {
    decoder: any;

    constructor(_: any) {
        super();
        this.decoder = new Zstd();
    }

    async decodeBlock(buffer: ArrayBuffer) {
        const bytes = new Uint8Array(buffer);
        const decoded = await this.decoder.decode(bytes);
        return decoded.buffer;
    }
}
