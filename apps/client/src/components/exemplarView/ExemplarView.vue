<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, PolygonLayer } from '@deck.gl/layers';
import {
    type DataPoint,
    type ExemplarTrack,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { storeToRefs } from 'pinia';
import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';
import CellSnippetsLayer from '../layers/CellSnippetsLayer';
import {
    constructGeometryBase,
    hexListToRgba,
    HORIZON_CHART_MOD_OFFSETS,
} from './deckglUtil';
import { schemeBlues } from 'd3-scale-chromatic';
import { isEqual } from 'lodash';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';

const deckGlContainer = ref<HTMLCanvasElement | null>(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

const exemplarViewStore = useExemplarViewStore();
const cellMetaData = useCellMetaData();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized } = storeToRefs(datasetSelectionStore);

const { viewConfiguration, exemplarTracks } = storeToRefs(exemplarViewStore);

// Reactive reference for totalExperimentTime
const totalExperimentTime = ref(0);

// Reactive Deck.gl instance
const deckgl = ref<any | null>(null);

// Watcher to initialize Deck.gl when experimentDataInitialized becomes true
watch(
    () => experimentDataInitialized.value,
    async (initialized) => {
        if (initialized) {
            // Fetch total experiment time
            totalExperimentTime.value =
                await exemplarViewStore.getTotalExperimentTime();

            // Initialize Deck.gl if not already initialized
            if (!deckgl.value) {
                deckgl.value = new Deck({
                    initialViewState: {
                        zoom: 0,
                        target: [0, 0],
                        minZoom: -8,
                        maxZoom: 8,
                    },
                    canvas: deckGlContainer.value,
                    views: new OrthographicView({
                        id: 'exemplarController',
                        controller: true,
                    }),
                    controller: true,
                    layers: [],
                });
            }

            // Render Deck.gl layers
            renderDeckGL();
        } else {
            // If not initialized, clean up Deck.gl instance
            if (deckgl.value) {
                deckgl.value.finalize();
                deckgl.value = null;
            }
            totalExperimentTime.value = 0;
        }
    },
    { immediate: false } // We don't need to run this immediately on mount
);

// Clean up Deck.gl on component unmount
onBeforeUnmount(() => {
    if (deckgl.value) {
        deckgl.value.finalize();
        deckgl.value = null;
    }
});

// Function to render Deck.gl layers
function renderDeckGL(): void {
    if (!deckgl.value) return;

    recalculateExemplarYOffsets();

    const layers: any[] = [];
    layers.push(createHorizonChartLayer());
    layers.push(createImageSnippetLayer());
    layers.push(createSnippetBoundaryLayer());
    layers.push(createTimeWindowLayer());
    layers.push(createSidewaysHistogramLayer());
    layers.push(createPinsAndLinesLayer());

    deckgl.value.setProps({
        layers,
        controller: true,
    });
}

// Watcher to re-render Deck.gl when exemplarTracks change
watch(
    exemplarTracks,
    () => {
        renderDeckGL();
    },
    { deep: true }
);

const exemplarYOffsets = ref(new Map<string, number>());

function recalculateExemplarYOffsets(): void {
    exemplarYOffsets.value.clear();
    let yOffset = 0;
    let lastExemplar = exemplarViewStore.exemplarTracks[0];
    for (let i = 0; i < exemplarViewStore.exemplarTracks.length; i++) {
        const exemplar = exemplarViewStore.exemplarTracks[i];
        yOffset += exemplarViewStore.exemplarHeight;
        if (i !== 0) {
            if (isEqual(exemplar.tags, lastExemplar.tags)) {
                yOffset += viewConfiguration.value.betweeenExemplarGap;
            } else {
                yOffset += viewConfiguration.value.betweenConditionGap;
            }
        }
        lastExemplar = exemplar;
        const key = uniqueExemplarKey(exemplar);
        exemplarYOffsets.value.set(key, yOffset);
    }
}

function uniqueExemplarKey(exemplar: ExemplarTrack): string {
    return exemplar.trackId + '-' + exemplar.locationId;
}

function createHorizonChartLayer(): HorizonChartLayer[] | null {
    const horizonChartLayers: HorizonChartLayer[] = [];

    for (const exemplar of exemplarViewStore.exemplarTracks) {
        const yOffset =
            exemplarYOffsets.value.get(uniqueExemplarKey(exemplar))! -
            viewConfiguration.value.timeBarHeightOuter -
            viewConfiguration.value.horizonTimeBarGap;

        const geometryData = constructGeometry(exemplar);
        horizonChartLayers.push(
            new HorizonChartLayer({
                id: `exemplar-horizon-chart-${uniqueExemplarKey(exemplar)}`,
                data: HORIZON_CHART_MOD_OFFSETS,

                instanceData: geometryData,
                destination: [
                    yOffset,
                    0,
                    viewConfiguration.value.horizonChartWidth,
                    viewConfiguration.value.horizonChartHeight,
                ], // [bottom, left, width, height]
                dataXExtent: [exemplar.minTime, exemplar.maxTime],

                baseline: 0,
                binSize: 200,

                getModOffset: (d: any) => d,
                positiveColors: hexListToRgba(schemeBlues[6]),
                negativeColors: hexListToRgba(schemeBlues[6]),
                updateTriggers: {
                    instanceData: geometryData,
                },
            })
        );
    }
    return horizonChartLayers;
}

function constructGeometry(track: ExemplarTrack): number[] {
    return constructGeometryBase(track.data, cellMetaData.timestep);
}

function createImageSnippetLayer():
    | CellSnippetsLayer[]
    | PolygonLayer[]
    | null {
    // TODO: implement

    const placeholderLayer: PolygonLayer[] = [];

    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-placeholder`,
            data: exemplarViewStore.exemplarTracks,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset =
                    exemplarYOffsets.value.get(uniqueExemplarKey(exemplar))! -
                    viewConfiguration.value.timeBarHeightOuter -
                    viewConfiguration.value.horizonTimeBarGap -
                    viewConfiguration.value.horizonChartHeight -
                    viewConfiguration.value.snippetHorizonChartGap;
                return [
                    [0, yOffset],
                    [viewConfiguration.value.horizonChartWidth, yOffset],
                    [
                        viewConfiguration.value.horizonChartWidth,
                        yOffset - viewConfiguration.value.snippetDisplayHeight,
                    ],
                    [0, yOffset - viewConfiguration.value.snippetDisplayHeight],
                    [0, yOffset],
                ];
            },
            getLineColor: [225, 30, 10, 200],
            getFillColor: [225, 30, 10, 100],
            getLineWidth: 3,
            lineWidthUnits: 'pixels',
        })
    );
    return placeholderLayer;
}

function createSnippetBoundaryLayer(): CellSnippetsLayer | null {
    // TODO: implement
    return null;
}

function createTimeWindowLayer(): PolygonLayer[] | null {
    // TODO: implement
    const placeholderLayer: PolygonLayer[] = [];

    // Testing
    console.log('Total Experiment Time:', totalExperimentTime.value);

    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-time-window`,
            data: exemplarViewStore.exemplarTracks,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
                const cellBirthTime = 1; // TODO: Replace with actual data
                const cellDeathTime = 1; // TODO: Replace with actual data
                const timeBarWidth = viewConfiguration.value.horizonChartWidth;
                const cellBirthXValue =
                    (cellBirthTime / totalExperimentTime.value) * timeBarWidth;
                const cellDeathXValue =
                    timeBarWidth -
                    (cellDeathTime / totalExperimentTime.value) * timeBarWidth;
                return [
                    [cellBirthXValue, yOffset],
                    [cellDeathXValue, yOffset],
                    [
                        cellDeathXValue,
                        yOffset - viewConfiguration.value.timeBarHeightOuter,
                    ],
                    [
                        cellBirthXValue,
                        yOffset - viewConfiguration.value.timeBarHeightOuter,
                    ],
                    [cellBirthXValue, yOffset],
                ];
            },
            getFillColor: [144, 238, 144, 255],
            getLineWidth: 0,
            lineWidthUnits: 'pixels',
        })
    );
    // Add background rectangle half as tall
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-background-placeholder`,
            data: exemplarViewStore.exemplarTracks,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
                const quarterHeight =
                    viewConfiguration.value.timeBarHeightOuter / 4;
                return [
                    [0, yOffset - quarterHeight * 1.5],
                    [
                        viewConfiguration.value.horizonChartWidth,
                        yOffset - quarterHeight * 1.5,
                    ],
                    [
                        viewConfiguration.value.horizonChartWidth,
                        yOffset - quarterHeight * 2.5,
                    ],
                    [0, yOffset - quarterHeight * 2.5],
                    [0, yOffset - quarterHeight * 1.5],
                ];
            },
            getFillColor: [144, 238, 144, 255],
            getLineWidth: 0,
            lineWidthUnits: 'pixels',
        })
    );

    return placeholderLayer;
}

function createSidewaysHistogramLayer(): PolygonLayer[] | null {
    // TODO: implement
    const placeholderLayer: PolygonLayer[] = [];

    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-placeholder`,
            data: exemplarViewStore.exemplarTracks,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
                return [
                    [
                        -viewConfiguration.value.histogramWidth -
                            viewConfiguration.value.horizonHistogramGap,
                        yOffset,
                    ],
                    [-viewConfiguration.value.horizonHistogramGap, yOffset],
                    [
                        -viewConfiguration.value.horizonHistogramGap,
                        yOffset - exemplarViewStore.exemplarHeight,
                    ],
                    [
                        -viewConfiguration.value.histogramWidth -
                            viewConfiguration.value.horizonHistogramGap,
                        yOffset - exemplarViewStore.exemplarHeight,
                    ],
                    [
                        -viewConfiguration.value.histogramWidth -
                            viewConfiguration.value.horizonHistogramGap,
                        yOffset,
                    ],
                ];
            },
            getLineColor: [225, 30, 210, 200],
            getFillColor: [225, 30, 210, 100],
            getLineWidth: 2,
            lineWidthUnits: 'pixels',
        })
    );
    return placeholderLayer;
}

function createPinsAndLinesLayer(): null {
    // TODO: implement
    return null;
}
</script>

<template>
    <!-- Only render the canvas if the experiment data is initialized -->
    <canvas
        v-if="experimentDataInitialized"
        id="exemplar-deckgl-canvas"
        ref="deckGlContainer"
    ></canvas>
</template>

<style scoped lang="scss"></style>
