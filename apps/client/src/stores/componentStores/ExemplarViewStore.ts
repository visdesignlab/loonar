import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';

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
                return result[0].max_time - result[0].min_time;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error fetching total experiment time:', error);
            return 0;
        }
    }

    async function exemplarTotalCellTimes(
        drug: string,
        conc: string,
        p: number
    ): Promise<{
        birthTime: number;
        deathTime: number;
    }> {
        const pDecimal = p / 100;
        const timeColumn = 'Time (h)';
        const drugColumn = 'Drug';
        const concColumn = 'Concentration (um)';
        const massColumn = 'Mass (pg)';
        const trackColumn = 'track_id';
        const experimentName = currentExperimentMetadata?.value?.name;

        // This subquery aims to:
        //   1) Selects each track_id, calculates the averageMass for that cell.
        //   2) Uses PERCENTILE_CONT(p) to get the p-th percentile of averageMass
        //      among all cells in the same drug/conc group.
        //   3) Filters down to the single track_id whose averageMass == p-th percentile.
        //   4) Limits to 1 track_id (in case multiple tie the exact percentile).
        //
        // Then the outer query:
        //   - Finds MIN and MAX of timeColumn for that chosen track_id.
        const query = `
                WITH avg_mass_per_cell AS (
                SELECT
                    "${trackColumn}" AS track_id,
                    AVG("${massColumn}") AS avg_mass
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${drugColumn}" = '${drug}'
                    AND "${concColumn}" = '${conc}'
                GROUP BY "${trackColumn}"
                ),
                mass_threshold AS (
                SELECT quantile_cont(avg_mass, ${pDecimal}) AS threshold
                FROM avg_mass_per_cell
                ),
                selected_cell AS (
                SELECT track_id
                FROM avg_mass_per_cell
                JOIN mass_threshold ON TRUE
                WHERE avg_mass >= threshold
                ORDER BY avg_mass
                LIMIT 1
                )
                SELECT
                MIN("${timeColumn}") AS birthTime,
                MAX("${timeColumn}") AS deathTime
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${trackColumn}" = (
                SELECT track_id FROM selected_cell
                );
            `;

        try {
            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            console.log(
                `Query Result for condition ${drug}-${conc} with p=${p}:`,
                JSON.stringify(result, null, 2)
            );

            if (result && result.length > 0) {
                const { birthTime, deathTime } = result[0];
                console.log(
                    `Condition: ${drug}-${conc}, Birth Time: ${birthTime}, Death Time: ${deathTime}`
                );
                return {
                    birthTime: birthTime || 0,
                    deathTime: deathTime || 100,
                };
            } else {
                console.warn(
                    `No results found for condition ${drug}-${conc} with p=${p}`
                );
                return { birthTime: 0, deathTime: 100 };
            }
        } catch (error) {
            console.error(
                `Error querying times for ${drug}-${conc} with p=${p}:`,
                error
            );
            return { birthTime: 0, deathTime: 100 };
        }
    }

    async function generateTestExemplarTrack(
        drug: string,
        conc: string,
        p: number
    ): Promise<ExemplarTrack> {
        const data: DataPoint[] = [];
        const trackLength = 10 + Math.round(Math.random() * 100);
        const tstart = Math.round(Math.random() * 50);
        for (let i = 0; i < trackLength; i++) {
            const time = tstart + i + 0.2 * Math.random();
            data.push({
                time,
                frame: tstart + i,
                value: 100 + Math.random() * 1000,
            });
        }
        const { birthTime, deathTime } = await exemplarTotalCellTimes(
            drug,
            conc,
            p
        );
        return {
            trackId: `${drug}-${conc}-${p}`, // fake, but fine for now
            locationId: `${drug}-${conc}`, // fake, but fine for now
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

    return {
        generateTestExemplarTracks,
        exemplarTracks,
        viewConfiguration,
        exemplarHeight,
        getTotalExperimentTime,
        exemplarTotalCellTimes,
    };
});
