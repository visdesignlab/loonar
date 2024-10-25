<script setup lang="ts">
import { ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

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
const { conditionChartSelections  } = useMosaicSelectionStore();
const { conditionChartSelectionsInitialized} = storeToRefs(useMosaicSelectionStore());
const { chartColorScheme } = useConditionSelectorStore();

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);
watch([experimentDataInitialized, conditionChartSelections], async ([isInitialized, newConditionChartSelections]) => {    
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        console.log('Im here to make the chart')
        createChart(
            props.xAxisName,
            props.yAxisName,
        );
    }
}, {immediate : true, deep : true })


// Creates a new set of selections and adds them to an overall list that is updated whenever general mosaicSelection is updated.
// Returns the "base" and "filtered". Base a constant selection which is never updated. This is only to filter based on the tags. The "filteredSelection" is updated by other general filters (i.e. mosaicSelection).

// Styles
const lineColor = chartColorScheme[props.yIndex % 6]
const strokeWidth = 5;

async function createChart(
    xAxisName: string,
    yAxisName: string,
) {


    if (chartContainer.value ) {

        const source = `${props.tags[0][0]}-${props.tags[0][1]}_${props.tags[1][0]}-${props.tags[1][1]}`
        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            vg.areaY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: conditionChartSelections[source].baseSelection
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
                        filterBy: conditionChartSelections[source].baseSelection
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
                    opacity:0.5
                }
            ),
            // Plots Line Chart based on selection.
            vg.lineY(
                vg.from(
                    `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    {
                        filterBy: conditionChartSelections[source].filteredSelection
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
                    opacity:1
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
