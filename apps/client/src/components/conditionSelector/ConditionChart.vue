<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';
import { Query, min } from '@uwdata/mosaic-sql';

// We won't use this block later.
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
const cellMetaDataStore = useCellMetaData();
const { dataInitialized } = storeToRefs(cellMetaDataStore);

const globalSettings = useGlobalSettings();

// We will instead just check only if the experiment data is loaded.
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized } = storeToRefs(datasetSelectionStore);

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);

// Only create charts if data is loaded and ready.
onMounted(async () => {
    if (experimentDataInitialized) {
        // Wait for the DOM to update
        await nextTick();
        createChart(tags, chartWidth, chartHeight);
    }
});

// Styles
const lineColor = '#ff0000';
const strokeWidth = 3;

// These should be dynamic, not static values.
const chartWidth = 500;
const chartHeight = 500;
const tags = { drug: 'drug1', concentration: 0.5 };

// Takes in tag names and values, width, height. Creates chart.
function createChart(
    tags: { [key: string]: string | number },
    width: number,
    height: number
) {
    if (chartContainer.value) {
        // Soon to sort data based on tags (ex: only show data with drug: drug1 and concentration: 0.5)

        // Query
        const query = vg
            .Query()
            .select('*')
            .from('composite_experiment_cell_metadata');

        const chart = vg.plot(
            // Fills in area under line chart grey.
            vg.areaY(vg.from(query), {
                x: 'Frame',
                y1: 0,
                y2: 'Dry Mass (pg)',
                fill: 'grey',
                fillOpacity: 0.2,
                stroke: null,
            }),

            // Plots Line Chart
            vg.lineY(vg.from(query), {
                x: 'Frame',
                y: 'Dry Mass (pg)',
                stroke: lineColor,
                strokeWidth: strokeWidth,
            }),

            // General settings.
            vg.width(width),
            vg.height(height)

            // Get rid of axes
            // vg.axis(false),
            // vg.margin(0)
        );
        chartContainer.value.appendChild(chart);
    }
}
</script>

<template>
    <div ref="chartContainer"></div>
</template>

<style></style>
