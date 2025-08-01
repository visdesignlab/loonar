import { parse, type ParseResult } from 'papaparse';
import * as vg from '@uwdata/vgplot';
// import type {ExperimentMetadata}
import type { ExperimentMetadata } from '@/stores/dataStores/datasetSelectionUntrrackedStore';

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

        } catch (error) {
            const message = `Unexpected error when loading ${url} into DuckDb with file type ${type}.`;
            console.error(message);
            throw new Error(message);
        }
    } else if (type === 'parquet') {
        try {
            await vg.coordinator().exec([vg.loadParquet(tableName, url)]);

        } catch (error) {
            const message = `Unexpected error when loading ${url} into DuckDb with file type ${type}.`;
            console.error(message);
            throw new Error(message);
        }
    } else {
        const message = `Invalid File Type passed into function.`;
        console.error(message);
        throw new Error(message);
    }
}

export interface AggregateObject {
    functionName: string;
    label: string;
    attr1?: string;
    var1?: string;
    attr2?: string;
    customQuery?: string;
}

export async function addAggregateColumn(
    aggTable: string,
    compTable: string,
    aggObject: AggregateObject,
    headerTransforms: ExperimentMetadata['headerTransforms']
): Promise<string> {
    if (!headerTransforms) return '';
    const { functionName, attr1, var1, attr2, label, customQuery } = aggObject;

    const { id, mass, time } = headerTransforms;

    if (customQuery) {
        const newColumnName = label;

        await vg.coordinator().exec([
            `
                ALTER TABLE ${aggTable}
                ADD COLUMN "${newColumnName}" DOUBLE
            `,
        ]);

        // Keys match what you're replacing in custom sql query
        const replacements: Record<string, string | undefined> = {
            idColumn: id,
            compTable: compTable,
            timeColumn: time,
            massColumn: mass,
        };
        const filledCustomQuery = customQuery.replace(
            /{(\w+)}/g,
            (match, key) => {
                if (key in replacements && replacements[key] !== undefined) {
                    return replacements[key] as string;
                }
                return match;
            }
        );

        await vg.coordinator().exec([
            `
                UPDATE ${aggTable} as orig_agg_table
                SET "${newColumnName}" = (
                    SELECT "${functionName}"
                    FROM (
                        ${filledCustomQuery}
                    ) as custom_table
                    WHERE custom_table.tracking_id = orig_agg_table.tracking_id
                )
            `,
        ]);

        return newColumnName;
    } else {
        // Start new column name string
        let newColumnName = `${label ? label : functionName}${
            attr1 ? ` ${attr1}` : ''
        }`;
        // Add variables if present
        if (attr2) {
            newColumnName = `${newColumnName} ${attr2}`;
        }

        if (var1) {
            newColumnName = `${newColumnName} ${var1}`;
        }

        await vg.coordinator().exec([
            `
                ALTER TABLE ${aggTable}
                ADD COLUMN IF NOT EXISTS "${newColumnName}" DOUBLE
            `,
        ]);

        // Start function call string
        let functionCall = `${functionName}`;
        if (attr1 || attr2 || var1) {
            functionCall = `${functionCall}("${attr1}"`;
            // Add variables if present

            if (attr2) {
                functionCall = `${functionCall}, "${attr2}"`;
            }

            if (var1) {
                functionCall = `${functionCall},${var1}`;
            }

            // Close parentheses
            functionCall = `${functionCall})`;
        } else {
            functionCall = `${functionCall}(*)`;
        }


        console.log("Function Name:", functionCall);
        await vg.coordinator().exec([
            `
                UPDATE ${aggTable} as t1
                SET "${newColumnName}" = (
                    SELECT ${functionCall}
                    FROM ${compTable} as t2
                    WHERE t1.tracking_id = t2."${id}"
                    GROUP BY "${id}"
                )
            `,
        ]);

        return newColumnName;
    }
}

export async function createAggregateTable(
    tableName: string,
    headers: string[],
    headerTransforms: ExperimentMetadata['headerTransforms'],
    allTagNames: string[]
) {
    if (!headers || !headerTransforms) return;

    const { id, mass } = headerTransforms;

    let selectString = `AVG("${mass}") AS "Average ${mass}",`;

    headers.forEach((header: string) => {
        selectString = `
        ${selectString}
        MAX("${header}") AS "Maximum ${header}",
        MIN("${header}") AS "Minimum ${header}",
        `;
    });

    selectString = `
        ${selectString}
        MAX("Mass Norm") AS "Maximum Mass Norm",
        MIN("Mass Norm") AS "Minimum Mass Norm",
        MAX("Time Norm") AS "Maximum Time Norm",
        MIN("Time Norm") AS "Minimum Time Norm",
    `;
    // Join allTagNames into a comma-separated string
    const tagsSelection = allTagNames.map((tag) => `"${tag}"`).join(', ');

    try {
        try {
            await vg.coordinator().exec([
                `
                    DROP TABLE IF EXISTS ${tableName}_aggregate;
                `,
            ]);
        } catch (error) {
            console.error(error);
        }
        await vg.coordinator().exec([
            `
                CREATE TEMP TABLE IF NOT EXISTS ${tableName}_aggregate AS
                    SELECT 
                        ${selectString}
                        "${id}" as tracking_id,
                        location,
                        ${tagsSelection}    
                    FROM ${tableName}
                    GROUP BY "${id}", location, ${tagsSelection}
            `,
        ]);
    } catch (error) {
        console.error(error);
        const message = `Unexpected error when creating aggregate table.`;
        throw new Error(message);
    }
}

export async function addAdditionalCellColumns(
    tableName: string,
    headers: string[],
    headerTransforms: ExperimentMetadata['headerTransforms']
) {
    if (!headers || !headerTransforms) return;

    const { id, frame, mass, time } = headerTransforms;
    await vg.coordinator().exec([
        `
            ALTER TABLE ${tableName}
            ADD COLUMN IF NOT EXISTS "Mass Norm" DOUBLE
        `,
    ]);

    await vg.coordinator().exec([
        `
            WITH min_frame_mass AS (
                SELECT 
                    "${id}" AS tracking_id,
                    "${mass}" AS min_frame_mass
                FROM ${tableName}
                WHERE "${frame}" = (
                    SELECT MIN("${frame}")
                    FROM ${tableName} AS sub_table
                    WHERE sub_table."${id}" = ${tableName}."${id}"
                )
            )
            UPDATE ${tableName} AS orig_comp_table
            SET "Mass Norm" = "${mass}" / (
                SELECT min_frame_mass
                FROM min_frame_mass
                WHERE min_frame_mass.tracking_id = orig_comp_table."${id}"
            )
        `,
    ]);

    await vg.coordinator().exec([
        `
            ALTER TABLE ${tableName}
            ADD COLUMN IF NOT EXISTS "Time Norm" DOUBLE
        `,
    ]);

    await vg.coordinator().exec([
    `
        WITH min_time AS (
            SELECT 
                "${id}" AS tracking_id,
                MIN("${time}") AS min_time
            FROM ${tableName}
            GROUP BY "${id}"
        )
        UPDATE ${tableName} AS orig_comp_table
        SET "Time Norm" = COALESCE("${time}" - (
            SELECT min_time
            FROM min_time
            WHERE min_time.tracking_id = orig_comp_table."${id}"
        ), 0)
    `,
]);
}
