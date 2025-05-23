<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

import * as vg from '@uwdata/vgplot';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';

const props = defineProps<{
    xAxisName: string;
    yAxisName: string;
    width: number;
    height: number;
}>();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, compTableName } = storeToRefs(
    datasetSelectionStore
);
const { conditionChartSelections, $conditionChartYAxisDomain } =
    useMosaicSelectionStore();
const conditionSelectorStore = useConditionSelectorStore();

// Container for chart.
const chartContainer = ref<HTMLElement | null>(null);

// Final frame ref
const finalFrame = ref<number | null>(null);

const {
    xLabels,
    yLabels,
    selectedXTag,
    selectedYTag,
    selectedIndividualYAxis,
} = storeToRefs(conditionSelectorStore);

const $width = vg.Param.value(props.width);
const $height = vg.Param.value(props.height);

watch(
    () => props.width,
    (newWidth) => {
        $width.update(newWidth);
    }
);

watch(
    () => props.height,
    (newHeight) => {
        $height.update(newHeight);
    }
);

let observer: MutationObserver | null = null;
const isLoading = ref<boolean>(true);

// When axis of charts change, set loading to true
watch(selectedIndividualYAxis, () => {
    isLoading.value = true;
});

watch(
    [
        experimentDataInitialized,
        chartContainer,
        selectedIndividualYAxis,
        conditionChartSelections,
    ],
    async ([
        isInitialized,
        newChartContainer,
        newYAxis,
        newConditionChartSelections,
    ]) => {
        if (!isInitialized || !newChartContainer || !newYAxis) {
            return;
        }

        while (newChartContainer.firstChild) {
            newChartContainer.removeChild(newChartContainer.firstChild);
        }
        const res = await vg.coordinator().query(
            `SELECT MIN(max_frame) as final_frame FROM (
                        SELECT MAX("${props.xAxisName}") as max_frame
                        FROM ${compTableName.value}
                        GROUP BY "${selectedXTag.value}", "${selectedYTag.value}"
                    )`,
            { type: 'json' }
        );
        finalFrame.value = res[0].final_frame;

        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        const chart = createChart(props.xAxisName, newYAxis);

        if (!chart) {
            return;
        }

        newChartContainer.appendChild(chart);

        observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (
                    mutation.type === 'childList' &&
                    mutation.addedNodes.length > 0
                ) {
                    isLoading.value = false;
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
    },
    { deep: true }
);

const strokeWidth = 2;

function createChart(xAxisName: string, yAxisName: string) {
    if (!chartContainer.value) {
        return null;
    }
    const lines: any[] = [];
    xLabels.value.forEach((xLabel, idx) => {
        yLabels.value.forEach((yLabel, idy) => {
            const tempSource = `${selectedXTag.value}-${xLabel}_${selectedYTag.value}-${yLabel}`;

            const tempLine = vg.lineY(
                vg.from(compTableName.value, {
                    filterBy:
                        conditionChartSelections[tempSource]
                            .compChartFilteredSelection,
                }),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: vg.sql`'${yLabel}'`,
                    strokeWidth,
                    curve: 'linear',
                    opacity: 1,
                }
            );
            const tempBaseLine = vg.lineY(
                vg.from(compTableName.value, {
                    filterBy:
                        conditionChartSelections[tempSource]
                            .compChartBaseSelection,
                }),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    stroke: vg.sql`'${yLabel}'`,
                    strokeWidth,
                    curve: 'linear',
                    opacity: 0.3,
                }
            );
            lines.push(tempLine);
            lines.push(tempBaseLine);

            const tempText = vg.textX(
                vg.from(compTableName.value, {
                    filterBy:
                        conditionChartSelections[tempSource]
                            .compChartFilteredSelection,
                }),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    text: vg.sql`CONCAT("${selectedXTag.value}", ' - ', "${selectedYTag.value}")`,
                    textAnchor: 'start',
                    filter: vg.sql`"Frame ID" % ${finalFrame.value} = 0`,
                    fill: vg.sql`'${yLabel}'`,
                    dx: 10,
                }
            );

            const tempCircle = vg.dotX(
                vg.from(compTableName.value, {
                    filterBy:
                        conditionChartSelections[tempSource]
                            .compChartFilteredSelection,
                }),
                {
                    x: xAxisName,
                    y: vg.avg(yAxisName),
                    r: 3,
                    // stroke:'black',
                    // filter: vg.sql`"Frame ID" = (SELECT MAX("Frame ID") FROM ${compTableName.value} GROUP BY "${selectedXTag.value}", "${selectedYTag.value}")`,
                    filter: vg.sql`"Frame ID" % ${finalFrame.value} = 0`,
                    fill: vg.sql`'${yLabel}'`,
                }
            );
            lines.push(tempCircle);
            lines.push(tempText);
        });
    });

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
        vg.colorDomain(conditionSelectorStore.yLabels),
        vg.colorRange(conditionSelectorStore.chartColorScheme),
        vg.width($width),
        vg.height($height),
        vg.marginRight(100),
        vg.name('my-lines')
    );
    return chart;
}
</script>

<template>
    <div
        v-if="isLoading"
        style="position: absolute; top: 0px; left: 0px; gap: 10px"
        class="flex justify-center align-center full-height full-width"
    >
        <q-spinner />
        <div class="text-caption">Loading chart</div>
    </div>
    <div ref="chartContainer"></div>
    <div v-if="!isLoading" class="flex justify-start full-width text-center">
        <svg
            class="legend-svg"
            width="50"
            style="position: relative; overflow: visible"
            height="50"
            xmlns="http://www.w3.org/2000/svg"
        >
            <line
                stroke="currentColor"
                x1="0"
                y1="20"
                x2="15"
                y2="20"
                stroke-width="2"
            />
            <circle cx="15" cy="20" r="2" fill="currentColor" />
            <text
                x="20"
                y="23"
                font-family="Arial"
                font-size="10"
                fill="currentColor"
            >
                Selected
            </text>
            <line
                stroke="currentColor"
                x1="0"
                y1="38"
                x2="15"
                y2="38"
                stroke-width="1"
            />
            <text
                x="20"
                y="42"
                font-family="Arial"
                font-size="10"
                fill="currentColor"
            >
                Unselected
            </text>
        </svg>
    </div>
</template>

<style scoped lang="scss">
/* Add styles if necessary */
</style>
