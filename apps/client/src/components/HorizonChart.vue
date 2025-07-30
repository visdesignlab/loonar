<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { extent as d3Extent } from 'd3-array';
import { area } from 'd3-shape';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { schemeReds, schemeBlues } from 'd3-scale-chromatic';
import { v4 as uuidv4 } from 'uuid';

export interface HorizonChartSettings {
    baseline: number;
    modHeight: number;
    mirrorNegative: boolean;
    includeBinLine: boolean;
    positiveColorScheme: readonly (readonly string[])[];
    negativeColorScheme: readonly (readonly string[])[];
}

export default defineComponent({
    name: 'HorizonChart',
    props: {
        chartWidth: { type: Number, required: true },
        chartHeight: { type: Number, required: true },
        data: { type: Array as () => any[], required: true },
        timeAccessor: { type: Function, required: true },
        valueAccessor: { type: Function, required: true },
        selected: { type: Boolean, required: false }, // move to settings?
        settings: {
            type: Object as () => HorizonChartSettings,
            default: () => {
                return {
                    baseline: 0,
                    modHeight: null,
                    mirrorNegative: false,
                    includeBinLine: true,
                    positiveColorScheme: schemeReds,
                    negativeColorScheme: schemeBlues,
                };
            },
        },
        info: { type: String, required: true },
        maxColors: { type: Number, default: 6 },
    },
    setup(props) {
        function debug(): void {
        }
        function getReasonableModH(): number {
            const [minVal, maxVal] = d3Extent(
                props.data,
                props.valueAccessor as (
                    datum: any,
                    index: number,
                    array: Iterable<any>
                ) => string
            ) as unknown as [number, number];
            const extent = maxVal - minVal;
            if (extent === 0) return 1;
            return extent / props.maxColors;
        }
        const defaultSettings: HorizonChartSettings = {
            baseline: 0,
            modHeight: getReasonableModH(),
            mirrorNegative: false,
            includeBinLine: true,
            positiveColorScheme: schemeReds,
            negativeColorScheme: schemeBlues,
        };

        const mergedSettings = computed(() => {
            return { ...defaultSettings, ...props.settings };
        });

        const scaleX = computed(() => {
            const extent = d3Extent(
                props.data,
                props.timeAccessor as (
                    datum: any,
                    index: number,
                    array: Iterable<any>
                ) => string
            ) as unknown as [number, number];
            return scaleLinear().domain(extent).range([0, props.chartWidth]);
        });
        const scaleY = computed(() => {
            // return (y: number) => {
            return scaleLinear<number, number>()
                .domain([
                    mergedSettings.value.baseline,
                    mergedSettings.value.baseline +
                        mergedSettings.value.modHeight,
                ])
                .range([props.chartHeight, 0]);
            // };
        });
        const scaleYMod = computed(() => {
            return (y: number) => {
                return scaleLinear<number, number>()
                    .domain([
                        mergedSettings.value.baseline,
                        mergedSettings.value.baseline +
                            mergedSettings.value.modHeight,
                    ])
                    .range([props.chartHeight, 0])(
                    (y % mergedSettings.value.modHeight) +
                        mergedSettings.value.baseline
                );
            };
        });
        const clipPathId = ref(uuidv4());

        const areaGen = computed(() => {
            return area<any>()
                .x((d: any) => scaleX.value(props.timeAccessor(d)))
                .y1((d: any) => scaleY.value(props.valueAccessor(d)))
                .y0(scaleY.value(mergedSettings.value.baseline));
        });

        const areaPath = computed(() => {
            const path = areaGen.value(props.data);

            return path;
        });

        const offsetInfo = computed<{ transform: string; color: string }[]>(
            () => {
                const offsetInfo: { transform: string; color: string }[] = [];
                const [minVal, maxVal] = d3Extent(props.data, (point: any) =>
                    props.valueAccessor(point)
                ) as [number, number];
                const positiveCount = Math.ceil(
                    (maxVal - mergedSettings.value.baseline) /
                        mergedSettings.value.modHeight
                );
                const positiveScale = scaleOrdinal(
                    props.settings.positiveColorScheme[props.maxColors]
                );
                // console.count('offsetInfo');
                for (let i = 0; i < positiveCount; i++) {
                    // console.count('offsetInfo.for');
                    const verticalOffset = i * props.chartHeight;
                    const transform = `translate(0,${verticalOffset})`;
                    const colorKey = Math.min(
                        i,
                        props.maxColors - 1
                    ).toString();
                    const color = positiveScale(colorKey);
                    offsetInfo.push({ transform, color });
                }

                const negativeCount = Math.ceil(
                    Math.abs(minVal - mergedSettings.value.baseline) /
                        mergedSettings.value.modHeight
                );
                const negativeScale = scaleOrdinal(
                    props.settings.negativeColorScheme[props.maxColors]
                );

                for (let i = 0; i < negativeCount; i++) {
                    let verticalOffset = -(i + 1) * props.chartHeight;
                    let transform = `translate(0,${verticalOffset})`;
                    if (mergedSettings.value.mirrorNegative) {
                        verticalOffset -= props.chartHeight;
                        verticalOffset *= -1;
                        transform = `translate(0,${verticalOffset}),rotate(-180),scale(-1,1)`;
                    }

                    const colorKey = Math.min(
                        i,
                        props.maxColors - 1
                    ).toString();
                    const color = negativeScale(colorKey);
                    offsetInfo.push({ transform, color });
                }

                return offsetInfo;
            }
        );

        return {
            scaleX,
            scaleY,
            scaleYMod,
            clipPathId,
            areaGen,
            areaPath,
            offsetInfo,
            mergedSettings,
            debug,
        };
    },
});
</script>

<template>
    <clipPath :id="clipPathId">
        <rect
            fill="#ececec"
            x="0"
            y="0"
            :width="chartWidth"
            :height="chartHeight"
        ></rect>
    </clipPath>
    <rect
        fill="#ececec"
        x="0"
        y="0"
        stroke="black"
        :stroke-width="mergedSettings.includeBinLine ? 1.5 : 0"
        :width="chartWidth"
        :height="chartHeight"
        :class="selected ? 'selected' : ''"
    >
        <title>Info: {{ info }}</title>
    </rect>

    <g @mousemove="debug" :clip-path="`url(#${clipPathId})`">
        <path
            stroke="black"
            :stroke-width="mergedSettings.includeBinLine ? 0.5 : 0"
            v-for="(info, i) in offsetInfo"
            :key="i"
            :transform="info.transform"
            :d="areaPath ?? ''"
            :fill="info.color"
        ></path>
        <rect fill="#ececec"></rect>
    </g>
</template>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
// rect {
//     // fill: #f7ecec;
//     // fill: #f4eef1;
//     fill: #ececec;
// }

// .stroke-thin {
//     stroke: black;
//     stroke-width: 0.25;
// }

.selected {
    // stroke: green;
    // stroke-width: 4pt;
    outline: solid forestgreen 4px;
}
</style>
