<script setup lang="ts">
import { ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelector } from '@/stores/componentStores/conditionSelectorStore';

import * as vg from '@uwdata/vgplot';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';

// Props from parent component
// Accept props from the parent component
const props = defineProps<{
    tags: [string,string][];
    xAxisName: string;
    yAxisName: string;
    yIndex:number;
    selected:boolean;
}>();

// Will use soon for dark mode.
const globalSettings = useGlobalSettings();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);
const { addConditionChartSelection } = useMosaicSelectionStore();
const { chartColorScheme } = useConditionSelector();

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);
watch(experimentDataInitialized, async (isInitialized) => {    
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        createChart(
            props.xAxisName,
            props.yAxisName,
        );
    }
}, {immediate : true, deep:true})


// Creates a new set of selections and adds them to an overall list that is updated whenever general mosaicSelection is updated.
// Returns the "base" and "filtered". Base a constant selection which is never updated. This is only to filter based on the tags. The "filteredSelection" is updated by other general filters (i.e. mosaicSelection).
const {baseSelection, filteredSelection, opacityParam } = addConditionChartSelection(props.tags)


// Styles
console.log()
const lineColor = chartColorScheme[props.yIndex % 6]
const strokeWidth = 5;

// const $selected = vg.Param.value(0);
// $selected.update()

async function createChart(
    xAxisName: string,
    yAxisName: string,
) {
    if (chartContainer.value) {

        while (chartContainer.value.firstChild) {
            chartContainer.value.removeChild(chartContainer.value.firstChild);
        }

        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            vg.areaY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: baseSelection
                    }
                ),
                {
                    x: xAxisName,
                    y1: 0,
                    y: vg.avg(yAxisName),
                    fill: 'grey',
                    fillOpacity: 0.2,
                    curve: 'basis',
                    stroke: null,
                }
            ),
            vg.lineY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: baseSelection,
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
                    opacity:0.3
                }
            ),
            // Plots Line Chart based on selection.
            vg.lineY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: filteredSelection,
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
                    opacity:opacityParam
                }
            ),

            // Gets rid of axes and margins
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
