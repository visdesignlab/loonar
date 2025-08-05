<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useElementSize } from '@vueuse/core';
import {
    useCellMetaData,
    type Lineage,
    type Track,
    type Cell,
} from '@/stores/dataStores/cellMetaDataStore';
import { useDataPointSelection } from '@/stores/interactionStores/dataPointSelectionTrrackedStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import CellSnippetsLayer from './layers/CellSnippetsLayer.js';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import { clamp } from 'lodash-es';
import Pool from '../util/Pool';
import type { Feature } from 'geojson';
import {
    expandHeight,
    getMaxHeight,
    type BBox,
    getWidth,
    getHeight,
} from '@/util/imageSnippets';

import {
    loadOmeTiff,
    getChannelStats,
    ImageLayer,
    XRLayer,
    AdditiveColormapExtension,
} from '@hms-dbmi/viv';

import type { PixelData, PixelSource } from '@vivjs/types';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import {
    GeoJsonLayer,
    LineLayer,
    ScatterplotLayer,
    TextLayer,
} from '@deck.gl/layers/typed';
// @ts-ignore
import { TripsLayer } from '@deck.gl/geo-layers';
import { render } from 'vue';
import { useConfigStore } from '@/stores/misc/configStore';

const cellMetaData = useCellMetaData();

const dataPointSelection = useDataPointSelection();
const imageViewerStore = useImageViewerStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const datasetSelectionStore = useDatasetSelectionStore();
const { currentLocationMetadata } = storeToRefs(datasetSelectionStore);
const { contrastLimitSlider } = storeToRefs(imageViewerStoreUntrracked);
const { selectedTrack } = storeToRefs(cellMetaData);
const configStore = useConfigStore();
const eventBusStore = useEventBusStore();
const segmentationStore = useSegmentationStore();

const deckGlContainer = ref(null);
//////////////////////////
// start temp test code //
//////////////////////////
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

//////////////////////////
// end temp test code   //
//////////////////////////
let deckgl: any | null = null;
onMounted(() => {
    deckgl = new Deck({
        initialViewState: {
            zoom: 0,
            target: [0, 0, 0],
            minZoom: -8,
            maxZoom: 8,
        },
        // @ts-ignore
        canvas: deckGlContainer.value?.id,
        views: new OrthographicView({
            id: 'track-controller',
            controller: true,
        }),
        controller: true,
        layers: [],
        // debug: true,
        // onBeforeRender: (gl: any) => {
        //     console.count('before');
        // },
        // onAfterRender: (gl: any) => {
        //     console.count('after');
        // },
        // onError: (error: any, _layer: any) => {
        //     console.error('ERROR');
        // },
    });
    // renderDeckGL();
});

function createTestScatterLayer(): ScatterplotLayer {
    // test data with points positioned in a grid
    const testData = [];
    for (let x = -100; x < 100; x += 25) {
        for (let y = -100; y < 100; y += 25) {
            testData.push({
                position: [x, y],
                color: [
                    Math.random() * 255,
                    Math.random() * 255,
                    Math.random() * 255,
                ],
            });
        }
    }
    return new ScatterplotLayer({
        id: 'scatterplot-layer',
        data: testData,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        lineWidthMinPixels: 0,
        getLineWidth: 0,
        getPosition: (d: any) => d.position,
        getRadius: 5,
        getFillColor: (d) => d.color,
        // getLineColor: (d) => [0, 0, 0],
    });
}

function createDebugScatterPlotLayer(): ScatterplotLayer | null {
    if (!selections.value || selections.value.length == 0) return null;
    // test data with points positioned in a grid
    const bboxCorners = [];
    for (const selection of selections.value) {
        for (const snippet of selection.snippets) {
            bboxCorners.push({
                position: [snippet.destination[0], snippet.destination[1]],
                color: [
                    Math.random() * 255,
                    Math.random() * 255,
                    Math.random() * 255,
                ],
            });
        }
    }
    return new ScatterplotLayer({
        id: 'debug-scatterplot-layer',
        data: bboxCorners,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        lineWidthMinPixels: 0,
        getLineWidth: 0,
        getPosition: (d: any) => d.position,
        getRadius: 5,
        getFillColor: (d) => d.color,
        // getLineColor: (d) => [0, 0, 0],
    });
}

const segmentationData = ref<Feature[]>();

watch(selectedTrack, async () => {
    if (cellMetaData.selectedTrack == null) return;

    const dataRequests = [];
    const samples = [0, 0.25, 0.5, 0.75, 1];
    for (let sample of samples) {
        const index = Math.round(
            sample * (cellMetaData.selectedTrack.cells.length - 1)
        );
        dataRequests.push(
            segmentationStore.getCellSegmentation(
                cellMetaData.selectedTrack.cells[index]
            )
        );
    }

    Promise.all(dataRequests).then((data) => {
        segmentationData.value = data.filter((d) => d != null) as Feature[];
        renderDeckGL();
    });
});

const selections = computed<
    {
        c: number;
        z: number;
        t: number;
        snippets: {
            source: BBox;
            destination: number[];
        }[];
    }[]
>(() => {
    if (!segmentationData.value) return [];
    const selections: {
        c: number;
        z: number;
        t: number;
        snippets: {
            source: BBox;
            destination: BBox;
        }[];
    }[] = [];
    let xOffset = 0;
    const padding = 6;
    const maxHeight = getMaxHeight(segmentationData.value);
    for (let feature of segmentationData.value) {
        if (!feature) continue;
        if (!feature?.properties?.frame) continue;
        if (!feature?.bbox) continue;
        const t = feature.properties.frame - 1; // convert frame number to index
        const source = expandHeight(feature.bbox as BBox, maxHeight);
        const width = getWidth(source);
        const height = getHeight(source);
        const destination: BBox = [xOffset, 0, xOffset + width, -height];
        xOffset += width + padding;
        selections.push({
            c: imageViewerStore.selectedChannel,
            z: 0,
            t,
            snippets: [{ source, destination }],
        });
    }

    return selections;
});

function createTrackLayer(): CellSnippetsLayer | null {
    if (!segmentationData.value) return null;
    if (!selections.value || selections.value.length == 0) return null;

    return new CellSnippetsLayer({
        loader: pixelSource.value,
        id: 'track-view-gl-test-snippet-layer',
        contrastLimits: contrastLimit.value,
        selections: selections.value,
        channelsVisible: [true],
        extensions: [colormapExtension],
        colormap: imageViewerStore.colormap,
    });
}

function renderDeckGL(): void {
    if (deckgl == null) return;
    if (cellMetaData.selectedTrack == null) return;
    if (segmentationData.value == null) return;
    const layers = [];

    // layers.push(createTestScatterLayer());
    layers.push(createDebugScatterPlotLayer());
    layers.push(createTrackLayer());

    deckgl.setProps({
        layers,
        controller: true,
    });
}
watch(dataPointSelection.$state, renderDeckGL);
watch(imageViewerStore.$state, renderDeckGL);
watch(contrastLimitSlider, renderDeckGL);
</script>

<template>
    <canvas id="cell-track-deckgl-canvas" ref="deckGlContainer"></canvas>
</template>

<style scoped lang="scss"></style>
