import { parse, type ParseResult } from 'papaparse';
import * as vg from '@uwdata/vgplot';

export type CsvParserResults = ParseResult<AnyAttributes>;

type ParseCsvCompleteCallback = (results: CsvParserResults) => void;

type FileType = 'csv' | 'parquet';

export interface NumericalAttributes {
    [index: string]: number;
}

export interface StringAttributes {
    [index: string]: string;
}

export interface AnyAttributes {
    [index: string]: any;
}

export interface TextTransforms {
    [index: string]: string;
}

// Parses CSV file. Accepts callback for additional processing.
export function loadCsv(
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

// Gets correct URl and loads file into DuckDb with specified table name.
export async function loadFileIntoDuckDb(
    url: string,
    tableName: string,
    type: FileType
): Promise<void> {
    // const url = configStore.getDuckDbFileUrl(fileName);
    if (type === 'csv') {
        try {
            await vg.coordinator().exec([vg.loadCSV(tableName, url)]);
            console.log(`Got DuckDb file: ${url}`);
        } catch (error) {
            console.error(
                `Unexpected error when loading ${url} into DuckDb with file type ${type}`
            );
        }
    } else if (type === 'parquet') {
        try {
            await vg.coordinator().exec([vg.loadParquet(tableName, url)]);
            console.log(`Got DuckDb file: ${url}`);
        } catch (error) {
            console.error(
                `Unexpected error when loading ${url} into DuckDb with file type ${type}`
            );
        }
    } else {
        console.error(`Invalid File Type passed into function.`);
    }
}
