<script setup lang="ts">
import { computed, ref } from 'vue';
import HorizonChart from '@/components/HorizonChart.vue';
import { scaleLinear } from 'd3-scale';
import { format } from 'd3-format';

import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';

const looneageViewStore = useLooneageViewStore();

interface HorizonChartLegendProps {
    containerWidth: number;
    chartWidth: number;
    chartHeight: number;
    includeNegatives: boolean;
    baseline: number;
    showLines: boolean;
}
const containerHeight = 40;
const minVal = -6;
const maxVal = 6;
const fakeDataExtent = computed(() => {
    if (props.includeNegatives) {
        return [minVal, maxVal];
    }
    return [0, maxVal];
});
const fakeData = computed(() => {
    if (props.includeNegatives) {
        return [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    }
    return [0, 1, 2, 3, 4, 5, 6];
});
const props = defineProps<HorizonChartLegendProps>();
const scaleX = computed(() => {
    return scaleLinear()
        .domain(fakeDataExtent.value)
        .range([0, props.chartWidth]);
});
function getLegendLabel(val: number): string {
    return '';
    // const trueValue = val * looneageViewStore.modHeight + props.baseline;
    // const label = format('.2s')(trueValue);
    // if (val === -6) return label + ' <';
    // if (val === 6) return label + '+';
    // return label;
}

const svgContainer = ref<SVGElement | null>(null);
function exportSvg(): void {
    console.log('exportSVg called');
    if (svgContainer.value === null) return;
    const svgString =
        '<?xml version="1.0" standalone="no"?>\r\n' +
        svgContainer.value.outerHTML;
    const link = document.createElement('a');
    link.download = `legend.svg`;
    link.href = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
    link.click();
}
defineExpose({ exportSvg });
</script>

<template>
    <span>Legend</span>
    <svg
        ref="svgContainer"
        xmlns="http://www.w3.org/2000/svg"
        :width="props.containerWidth"
        :height="containerHeight"
    >
        <!-- <HorizonChart
            :chartWidth="props.chartWidth"
            :chartHeight="props.chartHeight"
            :data="fakeDataExtent"
            :selected="false"
            :settings="{
                baseline: 0,
                modHeight: 1,
                mirrorNegative: false,
                includeBinLine: props.showLines,
                positiveColorScheme:
                    looneageViewStore.positiveColorScheme.value,
                negativeColorScheme:
                    looneageViewStore.negativeColorScheme.value,
            }"
            :timeAccessor="(x: number) => x"
            :valueAccessor="(x: number) => x"
            :info="'NA'"
        ></HorizonChart> -->

        <g
            font-size="10"
            font-family="sans-serif"
            :transform="`translate(0, ${props.chartHeight + 5})`"
        >
            <line
                v-for="val in fakeData"
                :key="val"
                :x1="scaleX(val)"
                :x2="scaleX(val)"
                y1="-5"
                y2="0"
                stroke="currentColor"
            ></line>
            <text
                v-for="val in fakeData"
                :key="val"
                :x="scaleX(val)"
                y="0"
                fill="currentColor"
                text-anchor="middle"
                dominant-baseline="hanging"
            >
                {{ getLegendLabel(val) }}
            </text>
        </g>
    </svg>
</template>

<style scoped lange="scss">
svg {
    overflow: visible !important;
}

/* .svg-text-below {
    text-anchor: middle;
    dominant-baseline: hanging;
} */
</style>
@/stores/charts/looneageViewStore
