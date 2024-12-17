<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import { ScatterplotLayer } from '@deck.gl/layers';
import {
    type DataPoint,
    type ExemplarTrack,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
const exemplarViewStore = useExemplarViewStore();

import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
const cellMetaData = useCellMetaData();
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
import { PolygonLayer } from '@deck.gl/layers/typed';

const deckGlContainer = ref(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

const { viewConfiguration, exemplarTracks } = storeToRefs(exemplarViewStore);

let deckgl: any | null = null;
const initialViewState = {
    zoom: [0, 0],
    target: [0, 0],
    minZoom: -8,
    maxZoom: 8,
};

onMounted(() => {
    deckgl = new Deck({
        initialViewState,
        // @ts-ignore
        canvas: deckGlContainer.value?.id,
        views: new OrthographicView({
            id: 'exemplarController',
            controller: true,
        }),
        controller: true,
        layers: [],
        // debug: true,
        // onBeforeRender: (gl: any) => {
        //     console.count('before');
        //     console.log(gl);
        // },
        // onAfterRender: (gl: any) => {
        //     console.count('after');
        //     console.log(gl);
        // },
        // onError: (error: any, _layer: any) => {
        //     console.error('ERROR');
        //     console.log(error);
        // },
        // onWebGLInitialized: () => console.log('onWebGLInitialized'),
        // onViewStateChange: ({ viewState, oldViewState }) => {
        //     viewState.zoom[1] = 0;
        //     if (oldViewState && !isEqual(viewState.zoom, oldViewState.zoom)) {
        //         viewState.target[1] = oldViewState.target[1];
        //     }
        //     viewStateMirror.value = viewState as any;
        //     renderDeckGL();
        //     return viewState;
        // },
        // getTooltip: ({ object }) => {
        //     if (!object) return null;
        //     const trackId = object.trackId;
        //     if (trackId == null) return null;
        //     const time = dataPointSelectionUntrracked.hoveredTime;
        //     if (time == null) return null;
        //     const track = cellMetaData.trackMap?.get(trackId);
        //     if (!track) return null;
        //     const index = cellMetaData.getCellIndexWithTime(track, time);
        //     if (index === -1) return null;
        //     const cell = track.cells[index];
        //     if (!cell) return null;
        //     const formatter = format('.2f');
        //     let html = `<h5>Cell: ${trackId}</h5>`;
        //     html += `<div>Time: ${formatter(time)}</div>`;
        //     for (const {
        //         attrKey,
        //     } of looneageViewStore.horizonChartSettingList) {
        //         const val = formatter(cell.attrNum[attrKey]);
        //         html += `<div>${attrKey}: ${val}</div>`;
        //     }
        //     return {
        //         html,
        //     };
        // },
        // onClick(info, _event) {
        //     if (!info.object) {
        //         // canvas was clicked, but no cell object was picked
        //         dataPointSelection.selectedTrackId = null;
        //     }
        // },
        // onInteractionStateChange: () => console.log('onInteractionStateChange'),
        // onLoad: () => console.log('onLoad'),
    });
    renderDeckGL();
});

function renderDeckGL(): void {
    if (deckgl == null) return;

    recalculateExemplarYOffsets();

    const layers: any[] = [];
    layers.push(createHorizonChartLayer());
    layers.push(createImageSnippetLayer());
    layers.push(createSnippetBoundaryLayer());
    layers.push(createTimeWindowLayer());
    layers.push(createSidewaysHistogramLayer());
    layers.push(createPinsAndLinesLayer());

    deckgl.setProps({
        layers,
        controller: true,
    });
}

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

        // TODO: probably skip if not in viewport

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

    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-placeholder`,
            data: exemplarViewStore.exemplarTracks,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
                const cellBirthTime = exemplar.data[0].time;
                const cellDeathTime =
                    exemplar.data[exemplar.data.length - 1].time;
                return [
                    [0 + cellBirthTime, yOffset],
                    [
                        viewConfiguration.value.horizonChartWidth -
                            cellDeathTime,
                        yOffset,
                    ],
                    [
                        viewConfiguration.value.horizonChartWidth -
                            cellDeathTime,
                        yOffset - viewConfiguration.value.timeBarHeightOuter,
                    ],
                    [
                        0 + cellBirthTime,
                        yOffset - viewConfiguration.value.timeBarHeightOuter,
                    ],
                    [0 + cellBirthTime, yOffset],
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
    <canvas id="exemplar-deckgl-canvas" ref="deckGlContainer"></canvas>
</template>
<style scoped lang="scss"></style>
