<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

import * as vg from '@uwdata/vgplot';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';

const props = defineProps<{
    xAxisName: string;
    yAxisName: string;
    width:number;
}>();


// Will use soon for dark mode.
const globalSettings = useGlobalSettings();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, compTableName } = storeToRefs(
    datasetSelectionStore
);
const { conditionChartSelections, $conditionChartYAxisDomain } = useMosaicSelectionStore();
const conditionSelectorStore = useConditionSelectorStore();

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);

// Final frame ref
const finalFrame = ref<number | null>(null);

const { xLabels, yLabels, selectedXTag, selectedYTag, selectedGrid } =
    storeToRefs(conditionSelectorStore);

const $width = vg.Param.value(props.width);

watch(() => props.width, (newWidth) => {
    $width.update(newWidth);
})

let observer: MutationObserver | null = null;
const isLoading = ref<boolean>(true);

watch(
    [experimentDataInitialized, conditionChartSelections, chartContainer],
    async ([isInitialized, newConditionChartSelections, newChartContainer]) => {
        if (isInitialized && newChartContainer) {
            while (newChartContainer.firstChild) {
                newChartContainer.removeChild(newChartContainer.firstChild);
            }
            const res = await vg.coordinator().query(
                    `SELECT MIN(max_frame) as final_frame FROM (
                        SELECT MAX("${props.xAxisName}") as max_frame
                        FROM ${compTableName.value}
                        GROUP BY "${selectedXTag.value}", "${selectedYTag.value}"
                    )`, {type:'json'}
                )
            finalFrame.value = res[0].final_frame;

            await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
            const chart = createChart(props.xAxisName, props.yAxisName);

            if(chart){
                newChartContainer.appendChild(chart);

                observer = new MutationObserver((mutationsList) => {
                    for (const mutation of mutationsList) {
                        if (
                            mutation.type === 'childList' &&
                            mutation.addedNodes.length > 0
                        ) {
                            isLoading.value = false;
                            console.log('finished loading');
                            observer?.disconnect();
                            break;
                        }
                    }
                });

                // Observe the SVG for changes to its child elements
                observer.observe(chart, {
                    childList: true,
                    subtree: true,
                });
            }

        }
    },
    { deep: true }
);

const strokeWidth = 3;
const strokeWidthSelected = 2;

function createChart(xAxisName: string, yAxisName: string) {
    if (chartContainer.value) {

        const lines:any[] = []
        xLabels.value.forEach((xLabel,idx) => {
            yLabels.value.forEach((yLabel,idy) => {
                const tempSource = `${selectedXTag.value}-${xLabel}_${selectedYTag.value}-${yLabel}`;

                const tempLine = vg.lineY(
                    vg.from(
                        compTableName.value,
                        {
                            filterBy:
                                conditionChartSelections[tempSource].compChartFilteredSelection,
                        }
                    ),
                    {
                        x: xAxisName,
                        y: vg.avg(yAxisName),
                        stroke: vg.sql`CONCAT('${xLabel}', ' - ', '${yLabel}')`,
                        strokeWidth,
                        curve: 'basis',
                        opacity: 1
                    }
                )
                const tempBaseLine = vg.lineY(
                    vg.from(
                        compTableName.value,
                        {
                            filterBy:
                                conditionChartSelections[tempSource].compChartBaseSelection,
                        }
                    ),
                    {
                        x: xAxisName,
                        y: vg.avg(yAxisName),
                        stroke: vg.sql`CONCAT('${xLabel}', ' - ', '${yLabel}')`,
                        strokeWidth,
                        curve: 'basis',
                        opacity: 0.3
                    }
                )
                lines.push(tempLine)
                lines.push(tempBaseLine)

                const tempText = vg.textX(
                    vg.from(
                        compTableName.value,
                        {
                            filterBy:
                                conditionChartSelections[tempSource].compChartFilteredSelection,
                        }
                    ), {
                        x: xAxisName,
                        y: vg.avg(yAxisName),
                        text:vg.sql`CONCAT("${selectedXTag.value}", ' - ', "${selectedYTag.value}")`,
                        // filter: vg.sql`"Frame ID" = (SELECT MAX("Frame ID") FROM ${compTableName.value} GROUP BY "${selectedXTag.value}", "${selectedYTag.value}")`,
                        filter:vg.sql`"Frame ID" % ${finalFrame.value} = 0`,
                        fill: vg.sql`CONCAT('${xLabel}', ' - ', '${yLabel}')`,
                        dx:50
                    }
                )
                lines.push(tempText);
            })
        })



        // Creates chart, filtered by the selection that uses the query.
        const chart = vg.plot(
            // Fills in area under line chart grey (optional)
            ...lines,
            // Gets rid of axes and margins
            vg.axis(true),
            // Below would allow us to adjust the yAxis based on all the charts
            vg.yDomain($conditionChartYAxisDomain),
            vg.marginLeft(40),
            vg.marginBottom(40),
            vg.colorScheme("observable10"),
            vg.width($width),
            vg.height($width),
            vg.marginRight(100),
            vg.name("my-lines")
        );
        return chart;
    }
}
</script>

<template>
    <div
        v-if="isLoading"
        style="position:absolute;top:0px;left:0px;gap:10px;"
        class="flex justify-center align-center full-height full-width"
    >
        <q-spinner />
        <div class="text-caption">Loading chart</div>
    </div>
    <div ref="chartContainer"></div>
</template>

<style scoped lang="scss">
/* Add styles if necessary */
</style>
