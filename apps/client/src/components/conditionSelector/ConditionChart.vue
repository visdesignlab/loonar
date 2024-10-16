<script setup lang="ts">
import { computed, onMounted, ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
// import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';

// Props from parent component
// Accept props from the parent component
const props = defineProps<{
    tags: { [key: string]: string | number };
    xAxisName: string;
    yAxisName: string;
    width: number;
    height: number;
}>();

// Will use soon for dark mode.
const globalSettings = useGlobalSettings();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);
watch(experimentDataInitialized, async (isInitialized) => {
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        createChart(
            props.tags,
            props.xAxisName,
            props.yAxisName,
            props.width,
            props.height
        );
    }
}, {immediate : true})


// Styles
const lineColor = '#ff0000';
const strokeWidth = 3;

// These are examples. These should be dynamic, not static values.
// const chartWidth = 500;
// const chartHeight = 500;
// const tags = { drug: 'drug1', concentration: 0.5 };
// const xAxisName = 'Pixel Position Y (pixels)';
// const yAxisName = 'Frame';

// Takes in tag names and values, width, height. Creates chart.


function createChart(
    tags: { [key: string]: string | number },
    xAxisName: string,
    yAxisName: string,
    width: number,
    height: number
) {
    if (chartContainer.value) {
        // If experiment metadata not initialized, return. Change this??

        /*
        
        Idea is that we want to filter our data for this chart based on the tag values. To do this, we mimic a user selection by first creating the selection, updating the selection clause with the appropriate filter, then filtering the data based on this clause.

        Since no users directly interact with the selection, this will be enough to filter our data.

         */
        //Create a vg selection
        const tagSelection = computed(() => vg.Selection.single());
        // Set a unique source so we do not chain filters
        const source = 'test_source';
        // Create clause with filter predicate
        const clause = { source, predicate: "drug = 'tylenol'" };
        // Update selection
        tagSelection.value.update(clause);

        // vg.coordinator().exec("CREATE TEMP TABLE test_table_five AS (SELECT * FROM test_new_composite_experiment_cell_metadata)")
        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            vg.areaY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: tagSelection.value,
                    }
                ),
                {
                    x: xAxisName,
                    y1: 0,
                    y2: yAxisName,
                    fill: 'grey',
                    fillOpacity: 0.2,
                    curve: 'basis',
                    stroke: null,
                }
            ),
            // Plots Line Chart based on selection.
            vg.lineY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: tagSelection.value,
                    }
                ),
                {
                    x: xAxisName,
                    y: yAxisName,
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
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
