import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';

import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

export interface ExemplarTrack {
    trackId: string;
    locationId: string;
    minTime: number;
    maxTime: number;
    data: DataPoint[];
    tags: Record<string, string>;
    p: number; // the sample position, e.g. median has p=0.5
    pinned: boolean; // true if this is a user pinned exemplar
    starred: boolean; // true if this is a user starred exemplar
}

export interface DataPoint {
    time: number;
    frame: number;
    value: number;
}

export interface ViewConfiguration {
    afterStarredGap: number;
    snippetDisplayHeight: number;
    snippetHorizonChartGap: number;
    horizonChartHeight: number;
    horizonChartWidth: number;
    horizonTimeBarGap: number;
    timeBarHeightOuter: number;
    timeBarHeightInner: number;
    betweeenExemplarGap: number;
    betweenConditionGap: number;
    horizonHistogramGap: number;
    histogramWidth: number;
}

export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {
    const conditionSelector = useConditionSelectorStore();
    const { currentExperimentTags } = storeToRefs(conditionSelector);

    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
        snippetDisplayHeight: 80,
        snippetHorizonChartGap: 5,
        horizonChartHeight: 40,
        horizonChartWidth: 1000,
        horizonTimeBarGap: 5,
        timeBarHeightOuter: 12,
        timeBarHeightInner: 2,
        betweeenExemplarGap: 20,
        betweenConditionGap: 20,
        horizonHistogramGap: 5,
        histogramWidth: 150,
    });

    const exemplarHeight = computed(() => {
        return (
            viewConfiguration.value.snippetDisplayHeight +
            viewConfiguration.value.snippetHorizonChartGap +
            viewConfiguration.value.horizonChartHeight +
            viewConfiguration.value.horizonTimeBarGap +
            viewConfiguration.value.timeBarHeightOuter
        );
    });

    const exemplarTracks = ref<ExemplarTrack[]>([]);

    const datasetSelectionStore = useDatasetSelectionStore();
    const { experimentDataInitialized, currentExperimentMetadata } =
        storeToRefs(datasetSelectionStore);

    async function getTotalExperimentTime(): Promise<number> {
        if (
            !experimentDataInitialized.value ||
            !currentExperimentMetadata.value
        ) {
            return 0;
        }

        // Assume the time column is specified in headerTransforms
        const timeColumn =
            currentExperimentMetadata.value.headerTransforms?.time;

        if (!timeColumn) {
            console.error('Time column not defined in headerTransforms.');
            return 0;
        }

        const tableName = `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata`;

        const query = `
            SELECT MAX("${timeColumn}") as max_time, MIN("${timeColumn}") as min_time
            FROM "${tableName}"
        `;

        try {
            const result: { max_time: number; min_time: number }[] = await vg
                .coordinator()
                .query(query, { type: 'json' });
            if (
                result &&
                result.length > 0 &&
                result[0].max_time != null &&
                result[0].min_time != null
            ) {
                console.log(
                    'getTotalExperimentTime - min_time:',
                    result[0].min_time,
                    'max_time:',
                    result[0].max_time
                );
                return result[0].max_time - result[0].min_time;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error fetching total experiment time:', error);
            return 0;
        }
    }

    async function getExemplarTrackData(
        drug: string,
        conc: string,
        p: number
    ): Promise<{
        trackId: string;
        locationId: string;
        birthTime: number;
        deathTime: number;
        data: DataPoint[];
    }> {
        const pDecimal = p / 100;
        const timeColumn = 'Time (h)';
        const drugColumn = 'Drug';
        const concColumn = 'Concentration (um)';
        const massColumn = 'Mass (pg)';
        const trackColumn = 'track_id';
        const locationColumn = 'location';
        const experimentName = currentExperimentMetadata?.value?.name;

        const query = `
            WITH avg_mass_per_cell AS (
            SELECT
                "${trackColumn}" AS track_id,
                AVG("${massColumn}") AS avg_mass
            FROM "${experimentName}_composite_experiment_cell_metadata"
            WHERE "${drugColumn}" = '${drug}'
            AND "${concColumn}" = '${conc}'
            GROUP BY "${trackColumn}"
            )
            SELECT
                CAST("${trackColumn}" AS INTEGER) AS track_id,
                CAST("${locationColumn}" AS INTEGER) AS location,
                MIN("${timeColumn}") AS birthTime,
                MAX("${timeColumn}") AS deathTime,
                array_agg(
                    ARRAY[
                        "${timeColumn}",
                        "Frame ID",
                        "${massColumn}"
                    ]
                ) AS data
            FROM "${experimentName}_composite_experiment_cell_metadata"
            WHERE "${trackColumn}" = (
                SELECT track_id
                FROM avg_mass_per_cell
                WHERE avg_mass = (
                    SELECT quantile_disc(avg_mass, ${pDecimal})
                    FROM avg_mass_per_cell
                )
                LIMIT 1
            )
            GROUP BY
                "${trackColumn}",
                "${locationColumn}"
            `;

        try {
            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            if (result && result.length > 0) {
                const { track_id, location, birthTime, deathTime, data } =
                    result[0];
                // console.log(
                //     `getExemplarTrackData - Drug: ${drug}, Conc: ${conc}, p: ${p}`
                // );
                // console.log('Birth Time:', birthTime, 'Death Time:', deathTime);
                // console.log('Data Array:', data);

                // Map the returned array to DataPoint[] with BigInt conversion
                const mappedData: DataPoint[] = data.map((d: any[]) => ({
                    time: d[0], // Convert BigInt to Number
                    frame: d[1], // Convert BigInt to Number
                    value: d[2], // Convert BigInt to Number
                }));

                return {
                    trackId: track_id,
                    locationId: location,
                    birthTime: birthTime || 0, // Ensure Number type
                    deathTime: deathTime || 100, // Ensure Number type
                    data: mappedData || [],
                };
            } else {
                return {
                    trackId: '',
                    locationId: '',
                    birthTime: 0,
                    deathTime: 100,
                    data: [],
                };
            }
        } catch (error) {
            console.error(
                `Error querying times for ${drug}-${conc} with p=${p}:`,
                error
            );
            return {
                trackId: '',
                locationId: '',
                birthTime: 0,
                deathTime: 100,
                data: [],
            };
        }
    }

    async function generateTestExemplarTrack(
        drug: string,
        conc: string,
        p: number
    ): Promise<ExemplarTrack> {
        const { trackId, locationId, birthTime, deathTime, data } =
            await getExemplarTrackData(drug, conc, p);
        return {
            trackId: trackId,
            locationId: locationId,
            minTime: birthTime,
            maxTime: deathTime,
            data,
            tags: {
                drug: drug,
                conc: conc,
            },
            p,
            pinned: false,
            starred: false,
        };
    }

    async function generateTestExemplarTracks(): Promise<void> {
        exemplarTracks.value = [];
        const trackPromises: Promise<ExemplarTrack>[] = [];
        for (const drug of ['4HT', 'lap', 'dox']) {
            for (const conc of ['0.0016 um', '0.016 um', '0.08 um']) {
                for (const p of [5, 50, 95]) {
                    trackPromises.push(
                        generateTestExemplarTrack(drug, conc, p)
                    );
                }
            }
        }
        try {
            const tracks = await Promise.all(trackPromises);
            exemplarTracks.value.push(...tracks);
            console.log('Exemplar tracks successfully added:', tracks.length);
        } catch (error) {
            console.error('Error generating exemplar tracks:', error);
        }
    }

    async function getExemplarTrack(...tags: any[]): Promise<ExemplarTrack> {
        // Extract tags
        const [drug, conc, p] = tags;

        console.log('Drug:', drug, 'Conc:', conc, 'P:', p);

        // Get the data for the exemplar track
        const { birthTime, deathTime, data } = await getExemplarTrackData(
            drug,
            conc,
            p
        );

        console.log(
            'Birth Time:',
            birthTime,
            'Death Time:',
            deathTime,
            'Data:',
            data
        );

        // Define columns and table
        const timeColumn = 'Time (h)';
        const massColumn = 'Mass (pg)';
        const trackColumn = 'track_id';
        const experimentName = currentExperimentMetadata.value?.name;

        if (!experimentName) {
            console.error('Experiment name is undefined.');
            return {
                trackId: `${drug}-${conc}-${p}`,
                locationId: `${drug}-${conc}`,
                minTime: birthTime,
                maxTime: deathTime,
                data: [],
                tags: { drug, conc },
                p: Number(p),
                pinned: false,
                starred: false,
            };
        }

        const tableName = `${experimentName}_composite_experiment_cell_metadata`;

        // Query to fetch mass over time for the specific cell
        const query = `
            SELECT "${timeColumn}" AS time, "${massColumn}" AS mass
            FROM "${tableName}"
            WHERE "${trackColumn}" = (
                SELECT track_id
                FROM "${tableName}"
                WHERE "drug" = '${drug}'
                  AND "conc" = '${conc}'
                ORDER BY ABS(AVG("${massColumn}") - "p") ASC
                LIMIT 1
            )
            AND "${timeColumn}" BETWEEN ${birthTime} AND ${deathTime}
            ORDER BY "${timeColumn}" ASC
        `;

        try {
            const result: { time: number; mass: number }[] = await vg
                .coordinator()
                .query(query, { type: 'json' });

            const data: DataPoint[] = result.map((row) => ({
                time: row.time,
                frame: Math.floor(row.time), // Assuming frame is the integer part of time
                value: row.mass,
            }));

            return {
                trackId: `${drug}-${conc}-${p}`,
                locationId: `${drug}-${conc}`,
                minTime: birthTime,
                maxTime: deathTime,
                data,
                tags: { drug, conc },
                p: Number(p),
                pinned: false,
                starred: false,
            };
        } catch (error) {
            console.error(
                `Error fetching exemplar track for ${drug}-${conc}-${p}:`,
                error
            );
            return {
                trackId: `${drug}-${conc}-${p}`,
                locationId: `${drug}-${conc}`,
                minTime: birthTime,
                maxTime: deathTime,
                data: [],
                tags: { drug, conc },
                p: Number(p),
                pinned: false,
                starred: false,
            };
        }
    }

    async function getExemplarTracks(): Promise<ExemplarTrack[]> {
        exemplarTracks.value = [];
        const trackPromises: Promise<ExemplarTrack>[] = [];

        const allTags: Array<{ key: string; value: string }> = [];

        for (const key in currentExperimentTags.value) {
            const values = currentExperimentTags.value[key];
            values.forEach((value) => {
                allTags.push({ key, value });
            });
        }

        const generateCombinations = (
            tags: Array<{ key: string; value: string }>
        ): Array<Array<{ key: string; value: string }>> => {
            const tagMap: Record<string, string[]> = {};

            tags.forEach((tag) => {
                if (!tagMap[tag.key]) {
                    tagMap[tag.key] = [];
                }
                tagMap[tag.key].push(tag.value);
            });

            const keys = Object.keys(tagMap);
            const valueLists = keys.map((key) =>
                tagMap[key].map((value) => ({ key, value }))
            );

            const combinations: Array<Array<{ key: string; value: string }>> =
                [];

            const cartesian = (
                arr: Array<Array<{ key: string; value: string }>>,
                depth = 0,
                current: Array<{ key: string; value: string }> = []
            ) => {
                if (depth === arr.length) {
                    combinations.push([...current]);
                    return;
                }
                for (const item of arr[depth]) {
                    current.push(item);
                    cartesian(arr, depth + 1, current);
                    current.pop();
                }
            };

            cartesian(valueLists);

            return combinations;
        };

        const allCombinations = generateCombinations(allTags);

        allCombinations.forEach((combination) => {
            trackPromises.push(
                getExemplarTrack(...combination.map((tag) => tag.value))
            );
        });

        try {
            const tracks = await Promise.all(trackPromises);
            exemplarTracks.value.push(...tracks);
            console.log('Exemplar tracks successfully added:', tracks.length);
            return tracks;
        } catch (error) {
            console.error('Error generating exemplar tracks:', error);
            return exemplarTracks.value;
        }
    }

    return {
        generateTestExemplarTracks,
        getExemplarTracks,
        exemplarTracks,
        viewConfiguration,
        exemplarHeight,
        getTotalExperimentTime,
    };
});
