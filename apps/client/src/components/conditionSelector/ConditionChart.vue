<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';

// Will use soon for dark mode.
const globalSettings = useGlobalSettings();

// Checks if experiment data is initialized
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized } = storeToRefs(datasetSelectionStore);

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);

// *** Change to watch statement
onMounted(async () => {
    // Waits for experiment data to be loaded
    if (experimentDataInitialized) {
        await nextTick();
        createChart(tags, xAxisName, yAxisName, chartWidth, chartHeight);
    }
});

// Styles
const lineColor = '#ff0000';
const strokeWidth = 3;

// These are examples. These should be dynamic, not static values.
const chartWidth = 500;
const chartHeight = 500;
const tags = { drug: 'drug1', concentration: 0.5 };
const xAxisName = 'Frame';
const yAxisName = 'Dry Mass (pg)';

// Takes in tag names and values, width, height. Creates chart.
function createChart(
    tags: { [key: string]: string | number },
    xAxisName: string,
    yAxisName: string,
    width: number,
    height: number
) {
    if (chartContainer.value) {
        // Soon to sort data based on tags (ex: only show data with drug: drug1 and concentration: 0.5)
        const tagSelection = computed(() => vg.Selection.intersect());
        // const query =
        //    "SELECT * FROM current_experiment_cell_metadata WHERE drug = 'drug1' AND concentration = 0.5";
        // const source = ;
        // const predicate = query;
        // const clause = { source, predicate };
        // tagSelection.value.update(clause);

        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            vg.areaY(
                vg.from('composite_experiment_cell_metadata', {
                    filterBy: tagSelection,
                }),
                {
                    x: xAxisName,
                    y1: 0,
                    y2: yAxisName,
                    fill: 'grey',
                    fillOpacity: 0.2,
                    stroke: null,
                }
            ),

            // Plots Line Chart
            vg.lineY(
                vg.from('composite_experiment_cell_metadata', {
                    filterBy: tagSelection,
                }),
                {
                    x: xAxisName,
                    y: yAxisName,
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                }
            ),
            // General settings.
            vg.width(width),
            vg.height(height),

            // Gets rid of axes and margins!
            vg.axis(false),
            vg.margin(0)
        );
        chartContainer.value.appendChild(chart);
    }
}
</script>

<template>
    <div ref="chartContainer"></div>
</template>

<style></style>
