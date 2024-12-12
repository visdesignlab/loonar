<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
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
    tags: [string, string][];
    xAxisName: string;
    yAxisName: string;
    yIndex: number;
    selected: boolean;
    chartLineWidth:number;
    height:number;
}>();


const $height = vg.Param.value(props.height);

watch(() => props.height, (newHeight) => {
    console.log('observes updates in height on resize.')
    $height.update(newHeight);
})

// Will use soon for dark mode.
const globalSettings = useGlobalSettings();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, compTableName } = storeToRefs(
    datasetSelectionStore
);
const { conditionChartSelections, $conditionChartYAxisDomain } = useMosaicSelectionStore();
const { chartColorScheme } = useConditionSelectorStore();

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);

const isLoading = ref<boolean>(false);

watch(
    [experimentDataInitialized, conditionChartSelections, chartContainer],
    async ([isInitialized, newConditionChartSelections, newChartContainer]) => {
        if (isInitialized && newChartContainer) {

            while (newChartContainer.firstChild) {
                newChartContainer.removeChild(newChartContainer.firstChild);
            }

            await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
            const chart = createChart(props.xAxisName, props.yAxisName);

            if(chart){
                newChartContainer.appendChild(chart);
            }

        }
    },
    { deep: true }
);

// Styles
const lineColor = chartColorScheme[props.yIndex % 6];
const strokeWidth = props.chartLineWidth/2;
const strokeWidthSelected = props.chartLineWidth;

function createChart(xAxisName: string, yAxisName: string) {
    if (chartContainer.value) {
        const source = `${props.tags[0][0]}-${props.tags[0][1]}_${props.tags[1][0]}-${props.tags[1][1]}`;
        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            vg.areaY(
                vg.from(
                    compTableName.value,
                    {
                        filterBy:
                            conditionChartSelections[source].baseSelection,
                    }
                ),
                {
                    x: xAxisName,
                    y1: 0,
                    y: vg.avg(yAxisName),
                    fill: 'grey',
                    fillOpacity: 0.3,
                    curve: 'basis',
                    stroke: null,
                }
            ),
            vg.lineY(
                vg.from(
                    compTableName.value,
                    {
                        filterBy:
                            conditionChartSelections[source].baseSelection,
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    curve: 'basis',
                    opacity: 0.6,
                }
            ),
            vg.lineY(
                vg.from(
                    compTableName.value,
                    {
                        filterBy:
                            conditionChartSelections[source].filteredSelection,
                    }
                ),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: lineColor,
                    strokeWidth: strokeWidthSelected,
                    curve: 'basis',
                    opacity: 1,
                }
            ),

            // Gets rid of axes and margins
            vg.axis(false),
            // Below would allow us to adjust the yAxis based on all the charts
            vg.yDomain($conditionChartYAxisDomain),
            vg.margin(0),
            // vg.margin(40)
            // vg.style('height:100%')
            vg.height($height),
            vg.width($height)
        );
        return chart;
    }
}
</script>

<template>
    <div 
        v-if="isLoading"
        style="position:absolute;width:100%;height:100%;flex:1;display:flex;"
        class="flex justify-center"
    >
        <q-spinner/>
    </div>
    <div ref="chartContainer"></div>
</template>

<style></style>
