<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import {
    useAggregateLineChartStore,
    type AggDataPoint,
    type AggLineData,
} from '@/stores/componentStores/aggregateLineChartStore';
import { scaleLinear } from 'd3-scale';
import { extent, max, min } from 'd3-array';
import { area, line } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { select } from 'd3-selection';
import { format } from 'd3-format';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useDataPointSelection } from '@/stores/interactionStores/dataPointSelectionTrrackedStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import CellSnippetsLayer from './layers/CellSnippetsLayer';
import type { Selection } from './layers/CellSnippetsLayer';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { Deck, OrthographicView } from '@deck.gl/core/typed';
import {
    GeoJsonLayer,
    LineLayer,
    PathLayer,
    PolygonLayer,
    ScatterplotLayer,
    TextLayer,
} from '@deck.gl/layers/typed';
import type { PixelData, PixelSource } from '@vivjs/types';
import Pool from '../util/Pool';
import {
    loadOmeTiff,
    getChannelStats,
    AdditiveColormapExtension,
} from '@hms-dbmi/viv';
import { storeToRefs } from 'pinia';
import { LRUCache } from 'lru-cache';
import { getBBoxAroundPoint } from '@/util/imageSnippets';
import colors from '@/util/colors';
import { useConfigStore } from '@/stores/misc/configStore';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const configStore = useConfigStore();
const aggregateLineChartStore = useAggregateLineChartStore();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const dataPointSelection = useDataPointSelection();
const imageViewerStore = useImageViewerStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const datasetSelectionStore = useDatasetSelectionStore();
const looneageViewStore = useLooneageViewStore();
const { currentLocationMetadata } = storeToRefs(datasetSelectionStore);
const { contrastLimitSlider } = storeToRefs(imageViewerStoreUntrracked);
let { customXRangeMin, customXRangeMax } =
    storeToRefs(aggregateLineChartStore);

const aggLineChartContainer = ref(null);
const { width: containerWidth, height: outerContainerHeight } = useElementSize(
    aggLineChartContainer
);

// container height must be less than the outer container height in order for
// height to shrink when the outer container is reduced in height. Without
// the -10 neither height will reduce.
const containerHeight = computed(() =>
    Math.max(outerContainerHeight.value - 10, 0)
);
const margin = ref({ top: 30, left: 50, bottom: 50, right: 30 });
const chartWidth = computed(
    () => containerWidth.value - margin.value.left - margin.value.right
);
const chartHeight = computed(
    () => containerHeight.value - margin.value.top - margin.value.bottom
);

// Default custom X range where min and max are timeMin and timeMax.
function defaultCustomXRange() {
    let defaultDomain = extent(cellMetaData.timeList) as [number, number];

    // Set the default domain as the min and max time values from the data
    if (
        aggregateLineChartStore.aggLineDataList &&
        aggregateLineChartStore.aggLineDataList.length > 0
    ) {
        const timeMin = min(
            aggregateLineChartStore.aggLineDataList,
            (aggLineData) => min(aggLineData.data, (aggPoint: AggDataPoint) => aggPoint.time)
        );
        const timeMax = max(
            aggregateLineChartStore.aggLineDataList,
            (aggLineData) => max(aggLineData.data, (aggPoint: AggDataPoint) => aggPoint.time)
        );
        if (timeMin != null && timeMax != null) {
            defaultDomain = [timeMin, timeMax];
        }
        // If custom ranges are still null, initialize them
        if (customXRangeMin.value === null) {
            customXRangeMin.value = defaultDomain[0];
        }
        if (customXRangeMax.value === null) {
            customXRangeMax.value = defaultDomain[1];
        }
        console.log("Reset the custom x range to the default values", customXRangeMin.value, customXRangeMax.value);
    }
}
// Updates the custom X range when the time list changes
watch(
    () => [
        aggregateLineChartStore.targetKey,
        aggregateLineChartStore.aggregatorKey,
        aggregateLineChartStore.attributeKey
    ],
    () => {
        // Reinitialize with default values based on the current timeList and aggLineDataList
        defaultCustomXRange();
    }
);

// ScaleX set to custom x axis range.
const scaleX = computed(() => {
   
    const domain: [number, number] = [
        customXRangeMin.value ?? 0, 
        customXRangeMax.value ?? 1
    ];
    console.log("Domain:", domain);
    return scaleLinear().domain(domain).range([0, chartWidth.value]);
});

// Scale Y set to the extent of the data points in the y axis.
const scaleY = computed(() => {
    return scaleLinear()
        .domain(
            aggregateLineChartStore.aggLineDataListExtent as [number, number]
        )
        .range([chartHeight.value, 0]);
});

const temp = ref(0);

const areaGen = computed(() => {
    return area<AggDataPoint>()
        .x((aggPoint) => scaleX.value(aggPoint.time))
        .y0((aggPoint) =>
            scaleY.value(aggPoint.value + temp.value * aggPoint.count)
        )
        .y1((aggPoint) =>
            scaleY.value(aggPoint.value - temp.value * aggPoint.count)
        );
});

const areaGenHighlighted = computed(() => {
    return area<AggDataPoint>()
        .x((aggPoint) => scaleX.value(aggPoint.time))
        .y0((aggPoint) =>
            scaleY.value(aggPoint.value + temp.value * aggPoint.count)
        )
        .y1((aggPoint) =>
            scaleY.value(aggPoint.value - temp.value * aggPoint.count)
        )
        .defined((aggPoint) => aggPoint.highlighted ?? false);
});

const lineGen = computed(() => {
    return line<AggDataPoint>()
        .x((aggPoint) => scaleX.value(aggPoint.time))
        .y((aggPoint) =>
            scaleY.value(aggPoint.value + temp.value * aggPoint.count)
        );
});

const hoveredTimeLineGen = computed(() => {
    return line<number>()
        .x(() => scaleX.value(dataPointSelectionUntrracked.hoveredTime ?? 0))
        .y((val) => scaleY.value(val));
});

const currentTimeLineGen = computed(() => {
    return line<number>()
        .x(() => scaleX.value(dataPointSelection.currentTime))
        .y((val) => scaleY.value(val));
});

const varianceAreaGen = computed(() => {
    return area<AggDataPoint>()
        .x((aggPoint) => scaleX.value(aggPoint.time))
        .y0((aggPoint) => scaleY.value(aggPoint.variance?.[0] ?? 0))
        .y1((aggPoint) => scaleY.value(aggPoint?.variance?.[1] ?? 0));
});

const yAxisContainer = ref<SVGGElement | null>(null);
const xAxisContainer = ref<SVGGElement | null>(null);
const xAxisGen = computed(() => {
    return axisBottom(scaleX.value).ticks(Math.max(1, chartWidth.value / 80));
});
const yAxisGen = computed(() => {
    return axisLeft(scaleY.value)
        .ticks(Math.max(1, chartHeight.value / 80))
        .tickFormat(format('~s'));
});

const axisPading = ref(8);

watch(xAxisGen, () => {
    if (!xAxisContainer.value) return;
    select(xAxisContainer.value).call(xAxisGen.value);
});

watch(yAxisGen, () => {
    if (!yAxisContainer.value) return;
    select(yAxisContainer.value).call(yAxisGen.value);
});

function onClick(trackId: string | null) {
    dataPointSelection.selectedTrackId = trackId;
}
function onHover(trackId: string | null) {
    dataPointSelectionUntrracked.hoveredTrackId = trackId;
    if (trackId === null) {
        dataPointSelectionUntrracked.hoveredCellIndex = null;
    } else {
        dataPointSelectionUntrracked.setHoveredCellIndex();
    }
}

function onSvgClick() {
    if (dataPointSelectionUntrracked.hoveredTime === null) return;
    dataPointSelection.setCurrentFrameIndex(
        dataPointSelectionUntrracked.hoveredTime
    );
}
function onMouseMove(event: MouseEvent) {
    const xPos = event.offsetX - margin.value.left;

    let time = scaleX.value.invert(xPos);
    time = cellMetaData.getClosestTime(time);
    // if time is outside the range of time values do nothing
    const timeExtent = scaleX.value.domain();
    if (time < timeExtent[0] || time > timeExtent[1]) return;
    dataPointSelectionUntrracked.hoveredTime = time;
}

const deckGlContainer = ref(null);

// TODO: share cache with looneage view?
const lruCache = new LRUCache({
    max: 250,
});
let deckgl: any | null = null;
onMounted(() => {
    deckgl = new Deck({
        initialViewState: {
            zoom: [0, 0],
            target: [0, 0],
            minZoom: -8,
            maxZoom: 8,
        },
        views: new OrthographicView({
            id: 'lineChartController',
            controller: false,
        }),
        controller: false,
        // @ts-ignore
        canvas: deckGlContainer.value?.id,
        layers: [],
        debug: true,
        onError: (error: any, _layer: any) => {
            console.error('ERROR');
            console.log(error);
        },
        width: chartWidth.value,
        height: chartHeight.value,
        style: {
            left: `${margin.value.left}px`,
            top: `${margin.value.top}px`,
            position: 'absolute',
            // background: 'firebrick',
            // opacity: '0.4',
            outline: 'solid 2px forestgreen',
            pointerEvents: 'none',
        },
    });
});

const colormapExtension = new AdditiveColormapExtension();

const contrastLimit = computed<[number, number][]>(() => {
    return [[contrastLimitSlider.value.min, contrastLimitSlider.value.max]];
});
const loader = ref<any | null>(null);
const pixelSource = ref<any | null>(null);
const testRaster = ref<PixelData | null>(null);
watch(currentLocationMetadata, async () => {
    if (currentLocationMetadata.value?.imageDataFilename == null) return;
    if (deckgl == null) return;

    pixelSource.value = null;

    const fullImageUrl = configStore.getFileUrl(
        currentLocationMetadata.value.imageDataFilename
    );
    loader.value = await loadOmeTiff(fullImageUrl, { pool: new Pool() });
    imageViewerStoreUntrracked.sizeX = loader.value.metadata.Pixels.SizeX;
    imageViewerStoreUntrracked.sizeY = loader.value.metadata.Pixels.SizeY;
    imageViewerStoreUntrracked.sizeT = loader.value.metadata.Pixels.SizeT;
    imageViewerStoreUntrracked.sizeC = loader.value.metadata.Pixels.SizeC;

    testRaster.value = await loader.value.data[0].getRaster({
        selection: { c: imageViewerStore.selectedChannel, t: 0, z: 0 },
    });
    if (testRaster.value == null) return;
    const copy = testRaster.value.data.slice();
    const channelStats = getChannelStats(copy);
    contrastLimitSlider.value.min = channelStats.contrastLimits[0];
    contrastLimitSlider.value.max = channelStats.contrastLimits[1];
    imageViewerStore.contrastLimitExtentSlider.min = channelStats.domain[0];
    imageViewerStore.contrastLimitExtentSlider.max = channelStats.domain[1];

    pixelSource.value = loader.value.data[0] as PixelSource<any>;
    renderDeckGL();
});

function createCellSnippetLayer() {
    if (dataPointSelectionUntrracked.hoveredTime === null) return null;
    const trackId = dataPointSelectionUntrracked.hoveredTrackId;
    if (trackId === null) return null;
    const track = cellMetaData.trackMap?.get(trackId);
    if (track == null) return null;
    const index = dataPointSelectionUntrracked.hoveredCellIndex;
    if (index === null) return null;

    const cell = track.cells[index];
    const [x, y] = cellMetaData.getPosition(cell);
    const source = getBBoxAroundPoint(
        x,
        y,
        looneageViewStore.snippetSourceSize,
        looneageViewStore.snippetSourceSize
    );

    const chartX =
        scaleX.value(dataPointSelectionUntrracked.hoveredTime) -
        chartWidth.value / 2;
    const chartY =
        scaleY.value(aggregateLineChartStore.accessor(cell)) -
        chartHeight.value / 2;

    const padding = 10;
    const halfSize = looneageViewStore.snippetDestSize / 2;
    const destination = [
        chartX - halfSize,
        chartY - padding,
        chartX + halfSize,
        chartY - padding - looneageViewStore.snippetDestSize,
    ];
    console.log({
        source,
        destination,
    });

    const layers = [];
    layers.push(
        new CellSnippetsLayer({
            loader: pixelSource.value,
            id: `key-frames-snippets-in-line-chart-layer`,
            contrastLimits: contrastLimit.value,
            selections: [
                {
                    c: imageViewerStore.selectedChannel,
                    t: dataPointSelectionUntrracked.hoveredFrameIndex,
                    z: 0,
                    snippets: [
                        {
                            source,
                            destination: destination,
                        },
                    ],
                },
            ],
            channelsVisible: [true],
            extensions: [colormapExtension],
            colormap: imageViewerStore.colormap,
            cache: lruCache,
            onClick: () => {},
        })
    );

    layers.push(
        new ScatterplotLayer({
            id: 'test-scatterplot-in-line-chart-layer',
            data: [
                {
                    position: [chartX, chartY],
                    size: 1,
                    color: [200, 200, 0],
                },
            ],
            pickable: false,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: 6,
            radiusMinPixels: 1,
            radiusMaxPixels: 100,
            lineWidthMinPixels: 1,
            getPosition: (d) => d.position,
            getRadius: (d) => d.size,
            getFillColor: colors.hovered.rgb,
            getLineColor: (d) => [0, 0, 0],
        })
    );

    return layers;
}

function renderDeckGL() {
    if (deckgl == null) return;
    const layers = [];

    // layers.push(
    //     new ScatterplotLayer({
    //         id: 'test-scatterplot-in-line-chart-layer',
    //         data: [
    //             {
    //                 position: [0, 0],
    //                 size: 100,
    //                 color: [200, 200, 0],
    //             },
    //             {
    //                 position: [10, 10],
    //                 size: 80,
    //                 color: [0, 200, 200],
    //             },
    //             {
    //                 position: [20, 20],
    //                 size: 60,
    //                 color: [200, 0, 200],
    //             },
    //             {
    //                 position: [-10, -10],
    //                 size: 80,
    //                 color: [0, 200, 200],
    //             },
    //             {
    //                 position: [-20, -20],
    //                 size: 60,
    //                 color: [200, 0, 200],
    //             },
    //         ],
    //         pickable: false,
    //         opacity: 0.8,
    //         stroked: true,
    //         filled: true,
    //         radiusScale: 6,
    //         radiusMinPixels: 1,
    //         radiusMaxPixels: 100,
    //         lineWidthMinPixels: 1,
    //         getPosition: (d) => d.position,
    //         getRadius: (d) => d.size,
    //         getFillColor: (d) => d.color,
    //         getLineColor: (d) => [0, 0, 0],
    //     })
    // );

    layers.push(createCellSnippetLayer());

    deckgl.setProps({
        layers,
        // controller: true,
        width: chartWidth.value,
        height: chartHeight.value,
        style: {
            left: `${margin.value.left}px`,
            top: `${margin.value.top}px`,
            position: 'absolute',
            // background-color: 'rgba(255, 255, 255, 0.4)'
            // opacity: 0.4,
            outline: 'solid 2px forestgreen',
            pointerEvents: 'none',
        },
    });
}

watch(dataPointSelectionUntrracked.$state, renderDeckGL);

const relatedToSelection = computed(() => {
    return aggregateLineChartStore.aggLineDataList.filter((d) => !d.muted);
});

const relatedToSelectionLeft = computed(() => {
    return relatedToSelection.value.filter((d) => d.relation === 'left');
});

const relatedToSelectionRight = computed(() => {
    return relatedToSelection.value.filter((d) => d.relation === 'right');
});

const otherUnmuted = computed(() => {
    return relatedToSelection.value.filter(
        (d) => d.relation !== 'left' && d.relation !== 'right'
    );
});
</script>

<template>
    <NoDataSplash></NoDataSplash>
    <div v-if="cellMetaData.dataInitialized" class="d-flex flex-column h-100">
        <div ref="aggLineChartContainer" class="h-100">
            <svg
                :width="containerWidth"
                :height="containerHeight"
                @mousemove="onMouseMove"
                @mouseleave="dataPointSelectionUntrracked.hoveredTime = null"
                @click="onSvgClick"
            >
                <g
                    ref="yAxisContainer"
                    class="no-select"
                    :transform="`translate(${margin.left - axisPading}, ${
                        margin.top
                    })`"
                ></g>
                <g
                    ref="xAxisContainer"
                    class="no-select"
                    :transform="`translate(${margin.left}, ${
                        margin.top + chartHeight + axisPading
                    })`"
                ></g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`current time agg-line ${globalSettings.normalizedDark}`"
                        :d="currentTimeLineGen(scaleY.domain()) ?? ''"
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`hovered time agg-line ${globalSettings.normalizedDark}`"
                        v-if="dataPointSelectionUntrracked.hoveredTime !== null"
                        :d="hoveredTimeLineGen(scaleY.domain()) ?? ''"
                    ></path>
                </g>
                <g
                    v-if="aggregateLineChartStore.showVarianceBand"
                    :transform="`translate(${margin.left},${margin.top})`"
                >
                    <path
                        :class="`variance-band ${globalSettings.normalizedDark}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.aggLineDataList"
                        :key="index"
                        :d="varianceAreaGen(aggLine.data) ?? ''"
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`muted agg-line ${
                            globalSettings.normalizedDark
                        } ${aggLine.filtered ? 'filtered' : ''}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.aggLineDataList.filter(
                            (d) => d.muted
                        )"
                        :key="index"
                        :d="areaGen(aggLine.data) ?? ''"
                    ></path>
                    <!-- Path below is for individual cell tracks with highlighted cells. -->
                    <path
                        style="stroke-width: 2px"
                        :class="`highlighted-line ${globalSettings.normalizedDark}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.aggLineDataList.filter(
                            (d) => d.muted
                        )"
                        :key="'highlighted-' + index"
                        :d="areaGenHighlighted(aggLine.data) ?? ''"
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`agg-line ${globalSettings.normalizedDark}`"
                        v-for="(aggLine, index) in otherUnmuted"
                        :key="index"
                        :d="areaGen(aggLine.data) ?? ''"
                    ></path>
                </g>

                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`left agg-line ${globalSettings.normalizedDark}`"
                        v-for="(aggLine, index) in relatedToSelectionLeft"
                        :key="index"
                        :d="areaGen(aggLine.data) ?? ''"
                    ></path>
                </g>

                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`right agg-line ${globalSettings.normalizedDark}`"
                        v-for="(aggLine, index) in relatedToSelectionRight"
                        :key="index"
                        :d="areaGen(aggLine.data) ?? ''"
                    ></path>
                </g>

                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`selected agg-line ${globalSettings.normalizedDark}`"
                        v-if="aggregateLineChartStore.selectedLineData"
                        :d="
                            areaGen(
                                aggregateLineChartStore.selectedLineData.data
                            ) ?? ''
                        "
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`connection agg-line ${globalSettings.normalizedDark}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.extendedSelectedLineLineageConnections"
                        :key="index"
                        :d="lineGen(aggLine) ?? ''"
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`connection selected agg-line ${globalSettings.normalizedDark}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.selectedLineLineageConnections"
                        :key="index"
                        :d="lineGen(aggLine) ?? ''"
                    ></path>
                </g>
                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`hovered agg-line ${globalSettings.normalizedDark}`"
                        v-if="aggregateLineChartStore.hoveredLineData"
                        :d="
                            areaGen(
                                aggregateLineChartStore.hoveredLineData.data
                            ) ?? ''
                        "
                    ></path>
                </g>

                <g :transform="`translate(${margin.left},${margin.top})`">
                    <path
                        :class="`picking agg-line ${globalSettings.normalizedDark}`"
                        v-for="(
                            aggLine, index
                        ) in aggregateLineChartStore.aggLineDataList"
                        :key="index"
                        :d="areaGen(aggLine.data) ?? ''"
                        @mousemove="onHover(aggLine.trackId)"
                        @mouseout="onHover(null)"
                        @click="onClick(aggLine.trackId)"
                    ></path>
                </g>
            </svg>
        </div>
    </div>
    <canvas id="linechart-deckgl-canvas" ref="deckGlContainer"></canvas>
</template>

<style scoped lang="scss">
.variance-band {
    stroke-width: 1px;
    stroke-linejoin: round;
    opacity: 0.25;
}
.agg-line {
    stroke-width: 3px;
    stroke-linejoin: round;
    opacity: 0.95;
}

.left.agg-line {
    stroke: #1b9e77;
    fill: #1b9e77;
}

.right.agg-line {
    stroke: #7570b3;
    fill: #7570b3;
}
.muted.agg-line {
    stroke-width: 1px;
    opacity: 0.6;
}

.highlighted.agg-line {
    stroke-width: 3px;
    opacity: 1;
}

.filtered.agg-line {
    opacity: 0 !important;
}
.selected.agg-line {
    stroke-width: 4px;
}
.hovered.agg-line {
    stroke-width: 6px;
}
.connection.agg-line {
    stroke-dasharray: 4.5 6;
    stroke-width: 1.5px;
    opacity: 0.7;
}
.hovered.time.agg-line {
    stroke-width: 0.5px;
    // stroke-dasharray: 1 2;
    stroke: rgb(130, 130, 130);
    fill: rgb(130, 130, 130);
}

.current.time.agg-line {
    stroke-width: 1.5px;
    stroke: rgb(130, 130, 130);
    fill: rgb(130, 130, 130);
}

.picking.agg-line {
    stroke-width: 6;
    opacity: 0;
}

.dark {
    stroke: #377eb8;
    fill: #377eb8;
}

.dark.selected {
    stroke: #e29609;
    fill: #e29609;
}

.dark.hovered,
.light.hovered {
    stroke: #ffcf76;
    fill: #ffcf76;
}

.light {
    stroke: #377eb8;
    fill: #377eb8;
}

.light.selected {
    fill: #fde309;
    stroke: #fde309;
}

.mw-250 {
    max-width: 250px;
}

.deck-container-outer {
    background: bisque;
    outline: solid green 3px;
    width: 400px;
    height: 400px;

    // position: absolute;
    // top: 0;
    // left: 0;
    // width: 100%;
    // height: 100%;
    // background-color: white;
    // opacity: 0.2;
    // pointer-events: none;
}
// canvas {
//     // // background-color: white;
//     outline: solid 2px forestgreen;
//     position: absolute;
//     // // opacity: 0.2;
//     // pointer-events: none;
// }
</style>
