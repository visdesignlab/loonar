import { parse, type ParseResult } from 'papaparse';
import * as vg from '@uwdata/vgplot';
// import type {ExperimentMetadata}
import type { ExperimentMetadata } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import type { DataSelection } from '@/stores/interactionStores/selectionStore';

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

// Any reason these shouldn't be specifically typed?
export interface TextTransforms {
    [index: string]: string;
    // frame:string,
    // id:string,
    // mass:string,
    // parent:string,
    // time: string,
    // x:string,
    // y:string
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
            const message = `Unexpected error when loading ${url} into DuckDb with file type ${type}`;
            console.error(message);
            throw new Error(message);
        }
    } else if (type === 'parquet') {
        try {
            await vg.coordinator().exec([vg.loadParquet(tableName, url)]);
            console.log(`Got DuckDb file: ${url}`);
        } catch (error) {
            const message = `Unexpected error when loading ${url} into DuckDb with file type ${type}`;
            console.error(message);
            throw new Error(message);
        }
    } else {
        const message = `Invalid File Type passed into function.`;
        console.error(message);
        throw new Error(message);
    }
}


export async function createAggregateTable(tableName: string, headers: string[], headerTransforms: ExperimentMetadata['headerTransforms']) {
    if (headers && headerTransforms) {

        const { id } = headerTransforms

        let selectString = ``;

        headers.forEach((header: string) => {
            selectString = `
            ${selectString}
            AVG("${header}") AS "AVG ${header}",
            SUM("${header}") AS "SUM ${header}",
            COUNT("${header}") AS "COUNT ${header}",
            MEDIAN("${header}") AS "MEDIAN ${header}",
            MAX("${header}") AS "MAX ${header}",
            MIN("${header}") AS "MIN ${header}",
            `
        })

        try {
            try {
                await vg.coordinator().exec([`
                    DROP TABLE IF EXISTS ${tableName}_aggregate;
                `])
            } catch (error) {
                console.error(error);
            }
            await vg.coordinator().exec([`
                CREATE TEMP TABLE IF NOT EXISTS ${tableName}_aggregate AS
                    SELECT 
                        ${selectString}
                        "${id}" as tracking_id,
                        location
                    FROM ${tableName}
                    GROUP BY "${id}", location
            `]);
        } catch (error) {
            console.error(error);
            const message = `Unexpected error when creating aggregate table.`
            throw new Error(message);
        }
    }



}
