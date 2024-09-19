import { parse, type ParseResult } from 'papaparse';
import type { AnyAttributes } from '@/stores/dataStores/cellMetaDataStore';

export type CsvParserResults = ParseResult<AnyAttributes>;

type ParseCsvCompleteCallback = (results: CsvParserResults) => void;

export function parseCsv(
    csvUrl: string,
    completeCallback: ParseCsvCompleteCallback
): Promise<void> {
    return new Promise((resolve, reject) => {
        parse(csvUrl, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            download: true,
            worker: true,
            comments: '#',
            complete: async (results: ParseResult<AnyAttributes>) => {
                try {
                    completeCallback(results);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            },
        });
    });
}
