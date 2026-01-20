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

import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import { clamp, debounce } from 'lodash-es';
import Pool from '../util/Pool';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';

import {
    loadOmeTiff,
    getChannelStats,
    ImageLayer,
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
import { TripsLayer } from '@deck.gl/geo-layers/typed';
import { format } from 'd3-format';
import colors from '@/util/colors';
import { useConfigStore } from '@/stores/misc/configStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const configStore = useConfigStore();
const { darkMode } = storeToRefs(globalSettings);
const segmentationStore = useSegmentationStore();
const dataPointSelection = useDataPointSelection();
const imageViewerStore = useImageViewerStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const datasetSelectionStore = useDatasetSelectionStore();
const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const { currentLocationMetadata } = storeToRefs(datasetSelectionStore);
const { contrastLimitSlider, lastExperimentFilename } = storeToRefs(
    imageViewerStoreUntrracked
);
const eventBusStore = useEventBusStore();
const looneageViewStore = useLooneageViewStore();
const mosaicSelectionStore = useMosaicSelectionStore();
const { highlightedCellIds, unfilteredTrackIds } =
    storeToRefs(mosaicSelectionStore);

const deckGlContainer = ref(null);
const { width: containerWidth, height: containerHeight } =
    useElementSize(deckGlContainer);
const colormapExtension = new AdditiveColormapExtension();

const contrastLimit = computed<[number, number][]>(() => {
    return [[contrastLimitSlider.value.min, contrastLimitSlider.value.max]];
});

function _determineSelectedOrFiltered(trackId: string): {
    selected: boolean;
    filtered: boolean;
} {
    const frame = imageViewerStore.frameNumber;
    const location = currentLocationMetadata.value?.id;
    let selected = true;
    if (frame && location && highlightedCellIds.value) {
        // Generate Unique String to compare against list
        const unique_string = `${trackId}_${frame}_${location}`;
        selected = highlightedCellIds.value.includes(unique_string);
    }

    return {
        selected,
        filtered: unfilteredTrackIds.value
            ? !unfilteredTrackIds.value.includes(trackId)
            : false,
    };
}

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
        canvas: deckGlContainer.value?.id, // TODO: actually fix this ts error
        controller: true,
        layers: [],
        views: [
            new OrthographicView({
                id: 'ortho',
                controller: true,
            }),
        ],
        onViewStateChange: ({ viewState }) => {
            // limit the camera to keep the image visible
            if (loader.value == null) return viewState;
            const imageWidth = imageViewerStoreUntrracked.sizeX;
            const imageHeight = imageViewerStoreUntrracked.sizeY;

            viewState.target[0] = clamp(viewState.target[0], 0, imageWidth);
            viewState.target[1] = clamp(viewState.target[1], 0, imageHeight);
            // viewState.zoom = clamp(viewState.zoom, -8, 8);
            return viewState;
        },
        debug: false,
        onClick(info, _event) {
            if (!info.object) {
                // canvas was clicked, but no cell object was picked
                clearSelection();
            }
        },
        // onBeforeRender: (gl: any) => {
        //     console.count('before');

        // },
        // onAfterRender: (gl: any) => {
        //     console.count('after');

        // },
        // onError: (error: any, _layer: any) => {
        //     console.error('ERROR');

        // },

        getTooltip: ({ object }) => {
            if (!object) return null;
            let { id, frame } = object.properties;
            if (id == null) return null;
            if (frame == null) return null;
            id = id.toString();
            const track = cellMetaData.trackMap?.get(id);
            if (!track) return null;
            const index = cellMetaData.getCellIndexWithFrame(track, frame);
            if (index === -1) return null;
            const cell = track.cells[index];
            if (!cell) return null;
            let html = `<h5>Cell: ${id}</h5>`;
            html += `<div>Frame: ${frame}</div>`;
            // const formatter = format('~s');
            const formatter = format('.2f');
            for (const {
                attrKey,
            } of looneageViewStore.horizonChartSettingList) {
                const val = formatter(cell.attrNum[attrKey]);
                html += `<div>${attrKey}: ${val}</div>`;
            }

            return {
                html,
            };
        },
    });
    eventBusStore.emitter.on('resetImageView', resetView);
});

const loader = ref<any | null>(null);
const pixelSource = ref<any | null>(null);
watch(currentLocationMetadata, async () => {
    if (currentLocationMetadata.value?.imageDataFilename == null) return;
    if (deckgl == null) return;
    // if (contrastLimitSlider == null) return;
    // renderLoadingDeckGL();
    // imageViewerStore.frameIndex = 0;
    pixelSource.value = null;

    const fullImageUrl = configStore.getFileUrl(
        currentLocationMetadata.value.imageDataFilename
    );
    loader.value = await loadOmeTiff(fullImageUrl, { pool: new Pool() });
    imageViewerStoreUntrracked.sizeX = loader.value.metadata.Pixels.SizeX;
    imageViewerStoreUntrracked.sizeY = loader.value.metadata.Pixels.SizeY;
    imageViewerStoreUntrracked.sizeT = loader.value.metadata.Pixels.SizeT;
    imageViewerStoreUntrracked.sizeC = loader.value.metadata.Pixels.SizeC;

    const raster: PixelData = await loader.value.data[0].getRaster({
        selection: { c: imageViewerStore.selectedChannel, t: 0, z: 0 },
    });
    const channelStats = getChannelStats(raster.data);
    const currentName =
        datasetSelectionTrrackedStore.currentExperimentFilename;
    const isNewExperiment = currentName !== lastExperimentFilename.value;
    if (
        isNewExperiment ||
        (contrastLimitSlider.value.min === 0 &&
            contrastLimitSlider.value.max === 0)
    ) {
        contrastLimitSlider.value.min = channelStats.contrastLimits[0];
        contrastLimitSlider.value.max = channelStats.contrastLimits[1];
        lastExperimentFilename.value = currentName;
    }
    imageViewerStore.contrastLimitExtentSlider.min = channelStats.domain[0];
    imageViewerStore.contrastLimitExtentSlider.max = channelStats.domain[1];
    // const contrastLimits: [number, number][] = [
    //     channelStats.contrastLimits as [number, number],
    // ];
    pixelSource.value = loader.value.data[0] as PixelSource<any>;
    renderDeckGL();
    // TODO: this is causing a minor visual bug, the loading is offset before the image is loaded.
    // but this is better than the image being offset for now.
    resetView();
});

watch(
    () => imageViewerStore.selectedChannel,
    async () => {
        if (currentLocationMetadata.value?.imageDataFilename == null) return;
        if (deckgl == null) return;
        if (loader.value == null) return;
        // if (contrastLimitSlider == null) return;
        // renderLoadingDeckGL();
        // imageViewerStore.frameIndex = 0;
        // pixelSource.value = null;

        // const fullImageUrl = configStore.getFileUrl(
        //     currentLocationMetadata.value.imageDataFilename
        // );
        // loader.value = await loadOmeTiff(fullImageUrl, { pool: new Pool() });
        // imageViewerStoreUntrracked.sizeX = loader.value.metadata.Pixels.SizeX;
        // imageViewerStoreUntrracked.sizeY = loader.value.metadata.Pixels.SizeY;
        // imageViewerStoreUntrracked.sizeT = loader.value.metadata.Pixels.SizeT;

        const raster: PixelData = await loader.value.data[0].getRaster({
            selection: { c: imageViewerStore.selectedChannel, t: 0, z: 0 },
        });
        const channelStats = getChannelStats(raster.data);
        const currentName =
            datasetSelectionTrrackedStore.currentExperimentFilename;
        const isNewExperiment = currentName !== lastExperimentFilename.value;
        if (
            isNewExperiment ||
            (contrastLimitSlider.value.min === 0 &&
                contrastLimitSlider.value.max === 0)
        ) {
            contrastLimitSlider.value.min = channelStats.contrastLimits[0];
            contrastLimitSlider.value.max = channelStats.contrastLimits[1];
            lastExperimentFilename.value = currentName;
        }
        imageViewerStore.contrastLimitExtentSlider.min = channelStats.domain[0];
        imageViewerStore.contrastLimitExtentSlider.max = channelStats.domain[1];
        renderDeckGL();
        // resetView();
    }
);

function createBaseImageLayer(): typeof ImageLayer {
    // If createNewLayer is false, we should reuse the existing imageLayer
    let id = imageLayer.value?.id ?? 'base-image-layer';
    if (refreshBaseImageLayer.value) {
        id = `base-image-layer-${imageViewerStore.frameNumber}`;
    }
    return new ImageLayer({
        loader: pixelSource.value,
        id,
        contrastLimits: contrastLimit.value,
        selections: imageViewerStore.selections,
        channelsVisible: [true],
        extensions: [colormapExtension],
        // @ts-ignore
        colormap: imageViewerStore.colormap,
        // onClick: () => console.log('click in base image layer'),
        // onViewportLoad: () => {
        //     console.log('image viewport load');
        // },
    });
}

function createSegmentationsLayer(): typeof GeoJsonLayer {
    const folderUrl = configStore.getFileUrl(
        datasetSelectionStore.currentLocationMetadata?.segmentationsFolder ??
            'UNKNOWN'
    );

    const hoverColorWithAlpha = colors.hovered.rgba;
    hoverColorWithAlpha[3] = 128;
    // @ts-ignore
    return new GeoJsonLayer({
        data: segmentationStore.getFrameSegmentations(
            imageViewerStore.frameNumber
        ),
        lineWidthUnits: 'pixels',
        id: 'segmentations',
        opacity: 1,
        stroked: true,
        filled: true,
        getFillColor: (info) => {
            if (
                info.properties?.id?.toString() ===
                dataPointSelectionUntrracked.hoveredTrackId
            ) {
                return hoverColorWithAlpha;
            }
            return [0, 0, 0, 0];
        },
        getLineColor: (info) => {
            if (
                info.properties?.id?.toString() ===
                dataPointSelection.selectedTrackId
            ) {
                return globalSettings.normalizedSelectedRgb;
            } else if (
                info.properties?.id?.toString() ===
                dataPointSelectionUntrracked.hoveredTrackId
            ) {
                return colors.hovered.rgb;
            }

            const { selected, filtered } = _determineSelectedOrFiltered(
                info.properties?.id?.toString()
            );
            // Removes outline
            // if (filtered) {
            //     return [0, 0, 0];
            // }
            if (selected) {
                return colors.highlightedBoundary.rgb;
            }
            return colors.unselectedBoundary.rgb;
        },
        getLineWidth: (info) => {
            if (
                info.properties?.id?.toString() ===
                dataPointSelection.selectedTrackId
            ) {
                return 3;
            }
            const { selected, filtered } = _determineSelectedOrFiltered(
                info.properties?.id?.toString()
            );
            if (selected) {
                return 2.5;
            }
            return 1.5;
        },
        pickable: true,
        onHover: onHover,
        onClick: onClick,
        updateTriggers: {
            getFillColor: [dataPointSelectionUntrracked.hoveredTrackId],
            getLineColor: [dataPointSelection.selectedTrackId],
            getLineWidth: [dataPointSelection.selectedTrackId],
        },
    });
}

interface GeoJsonFeature {
    type: 'Feature';
    bbox: [number, number, number, number]; // left, bottom, right, top
    properties: { id: number }; // could be anything, but mine should have id
}

function onHover(info: PickingInfo): void {
    if (!info.object) {
        dataPointSelectionUntrracked.hoveredTrackId = null;
        dataPointSelectionUntrracked.hoveredCellIndex = null;
        return;
    }
    const geoJsonFeature = info.object as GeoJsonFeature;

    dataPointSelectionUntrracked.hoveredTrackId =
        geoJsonFeature.properties.id?.toString();
    dataPointSelectionUntrracked.setHoveredCellIndex(
        dataPointSelection.currentTime
    );
}

function onClick(info: PickingInfo): void {
    if (!info.object) {
        return;
    }
    const geoJsonFeature = info.object as GeoJsonFeature;
    dataPointSelection.selectedTrackId =
        geoJsonFeature.properties.id?.toString();

    const lineageId = cellMetaData.getLineageId(cellMetaData.selectedTrack!);
    dataPointSelection.selectedLineageId = lineageId;
}

const lineageLayout = computed<LineageLayout>(() => {

    const layout: LineageLayout = { points: [], lines: [] };
    for (const lineage of currentLineageArray.value) {
        addSegmentsFromTrack(lineage.founder, layout);
    }
    return layout;
});

interface LineageLayout {
    lines: Segment[];
    points: LineagePoint[];
}

interface Segment {
    from: [number, number];
    fromId: string;
    to: [number, number];
    toId: string;
}

interface LineagePoint {
    position: [number, number];
    trackId: string;
    internal: boolean;
}

function addSegmentsFromTrack(
    track: Track,
    layout: LineageLayout
): [number, number] | null {
    let { lines, points } = layout;
    if (currentCellMap.value.has(track.trackId)) {
        const position = cellMetaData.getPosition(
            currentCellMap.value.get(track.trackId)!
        );
        points.push({
            position,
            internal: false,
            trackId: track.trackId,
        });
        return position;
    }
    const childrenInfo: { id: string; position: [number, number] }[] = [];
    // const childPositions: [number, number][] = [];
    const accumChildPositions: [number, number] = [0, 0];
    for (let child of track.children) {
        const childPos = addSegmentsFromTrack(child, layout);
        if (childPos === null) continue;
        childrenInfo.push({ id: child.trackId, position: childPos });
        // childPositions.push(childPos);
        accumChildPositions[0] += childPos[0];
        accumChildPositions[1] += childPos[1];
    }
    if (childrenInfo.length === 0) return null;
    accumChildPositions[0] /= childrenInfo.length;
    accumChildPositions[1] /= childrenInfo.length;

    for (let { id, position } of childrenInfo) {
        lines.push({
            from: accumChildPositions,
            fromId: track.trackId,
            to: position,
            toId: id,
        });
    }
    points.push({
        position: accumChildPositions,
        internal: true,
        trackId: track.trackId,
    });

    return accumChildPositions;
}

function createLineageLayer(): LineLayer {
    return new LineLayer({
        id: 'line-layer',
        widthUnits: 'pixels',
        data: lineageLayout.value.lines,
        pickable: false,
        getWidth: 5,
        getSourcePosition: (d: Segment) => d.from,
        getTargetPosition: (d: Segment) => d.to,
        // getColor: (d) => [Math.sqrt(d.inbound + d.outbound), 140, 0],
        getColor: (d: Segment) => {
            if (
                d.fromId === dataPointSelection.selectedTrackId ||
                d.toId === dataPointSelection.selectedTrackId
            ) {
                const c: [number, number, number, number] = [
                    ...globalSettings.normalizedSelectedRgba,
                ];
                c[3] = 125;
                return c;
            }
            return [228, 26, 28, 125];
        },
        updateTriggers: {
            getColor: dataPointSelection.selectedTrackId,
        },
    });
}

function createCenterPointLayer(): ScatterplotLayer {
    return new ScatterplotLayer({
        id: 'scatterplot-layer',
        lineWidthUnits: 'pixels',
        radiusUnits: 'pixels',
        data: lineageLayout.value.points,
        pickable: false,
        opacity: 1,
        stroked: true,
        filled: true,
        getPosition: (d) => d.position,
        getRadius: (d) => (d.internal ? 6 : 4),
        getFillColor: (d) => {
            if (d.trackId === dataPointSelectionUntrracked.hoveredTrackId) {
                const c: [number, number, number, number] = [
                    ...colors.hovered.rgba,
                ];
                c[3] = 120;
                return c;
            } else if (d.trackId === dataPointSelection.selectedTrackId) {
                const c: [number, number, number, number] = [
                    ...globalSettings.normalizedSelectedRgba,
                ];
                c[3] = 120;
                return c;
            }
            return d.internal ? [228, 26, 28, 125] : [228, 26, 28, 0];
        },
        getLineColor: (d) => {
            if (d.trackId === dataPointSelectionUntrracked.hoveredTrackId) {
                return colors.hovered.rgb;
            }
            if (d.trackId === dataPointSelection.selectedTrackId) {
                return globalSettings.normalizedSelectedRgb;
            }

            // const { filtered } = _determineSelectedOrFiltered(d.trackId);

            // if (filtered) {
            //     return [0, 0, 0, 0];
            // }

            return [228, 26, 28];
        },
        getStrokeWidth: 1,
        updateTriggers: {
            getFillColor: {
                selected: [dataPointSelection.selectedTrackId],
                hovered: [dataPointSelectionUntrracked.hoveredTrackId],
            },
            getLineColor: {
                selected: [dataPointSelection.selectedTrackId],
                hovered: [dataPointSelectionUntrracked.hoveredTrackId],
            },
        },
    });
}

// list of lineages present at the current frame
const currentLineageArray = computed<Lineage[]>(() => {
    const lineages: Lineage[] = [];
    const lineageIds = new Set<string>();
    for (let track of currentTrackArray.value) {
        const lineage = cellMetaData.getLineage(track);
        if (lineageIds.has(lineage.lineageId)) continue;
        lineageIds.add(lineage.lineageId);
        lineages.push(lineage);
    }

    return lineages;
});

// tracks that are only present at the current time point
const currentTrackArray = computed<Track[]>(() => {
    if (!cellMetaData.trackArray) return [];
    return cellMetaData.trackArray.filter((track: Track) => {
        const first = track.cells[0];
        const last = track.cells[track.cells.length - 1];
        return (
            cellMetaData.getFrame(first) <= imageViewerStore.frameNumber &&
            imageViewerStore.frameNumber <= cellMetaData.getFrame(last)
        );
    });
});

// cells that are at the current frame
const currentCellMap = computed<Map<string, Cell>>(() => {
    const cellMap = new Map<string, Cell>();
    if (!cellMetaData.cellArray) return cellMap;
    for (let cell of cellMetaData.cellArray) {
        if (cellMetaData.getFrame(cell) == imageViewerStore.frameNumber) {
            cellMap.set(cell.trackId, cell);
        }
    }
    return cellMap;
});

function createTrajectoryGhostLayer(): TripsLayer {
    return new TripsLayer({
    id: 'trips-layer',
    data: currentTrackArray.value,
    pickable: false,
    getWidth: 3,
    getPath: (d: Track) => d.cells.map((cell: Cell) => cellMetaData.getPosition(cell)),
    getTimestamps: (d: Track) => d.cells.map((cell: Cell) => cellMetaData.getFrame(cell)),
    getColor: [152, 78, 163],
    opacity: 0.6,
    rounded: true,
    fadeTrail: true,
    trailLength: imageViewerStore.effectiveTrailLength,
    currentTime: imageViewerStore.frameNumber,
    });
}

const imageLayer = ref();

// Once the user has stopped scrolling on frame number for 300ms, the createBaseImageLayer is refreshed to avoid lag error,
const refreshBaseImageLayer = ref<boolean>(false);
const updateBaseImageLayer = debounce(() => {
    refreshBaseImageLayer.value = true;
    renderDeckGL();
}, 300);
watch(() => imageViewerStore.frameNumber, updateBaseImageLayer);

function renderDeckGL(): void {
    if (deckgl == null) return;
    if (!cellMetaData.dataInitialized) {
        renderLoadingDeckGL();
        return;
    }
    const layers = [];
    if (imageViewerStore.showImageLayer) {
        if (pixelSource.value == null) return;
        imageLayer.value = createBaseImageLayer();
        layers.push(imageLayer.value);
        // No need to refresh unless debounce is called above.
        refreshBaseImageLayer.value = false;
    }
    if (imageViewerStore.showCellBoundaryLayer) {
        layers.push(createSegmentationsLayer());
    }
    if (imageViewerStore.showTrailLayer) {
        layers.push(createTrajectoryGhostLayer());
    }
    if (imageViewerStore.showLineageLayer) {
        layers.push(createLineageLayer());
        layers.push(createCenterPointLayer());
    }
    deckgl.setProps({
        layers,
        controller: true,
    });
}

function renderLoadingDeckGL(): void {
    if (deckgl == null) return;
    deckgl.setProps({
        layers: [
            new TextLayer({
                id: 'loading-screen-layer',
                data: ['Loading...'], // one hardcoded item
                pickable: false,
                getPosition: [0, 0],
                getText: (d) => d,
                getSize: 32,
                getAngle: 0,
                getTextAnchor: 'middle',
                getAlignmentBaseline: 'center',
            }),
        ],
        initialViewState: {
            zoom: 0,
            target: [0, 0, 0],
            minZoom: 0,
            maxZoom: 0,
        },
        controller: {
            scrollZoom: false,
            dragPan: false,
            dragRotate: false,
            doubleClickZoom: false,
            touchZoom: false,
            touchRotate: false,
            keyboard: false,
        }, // controller: false didn't seem to work..
    });
}

function resetView() {
    if (loader.value == null) return;
    const imageWidth = imageViewerStoreUntrracked.sizeX;
    const imageHeight = imageViewerStoreUntrracked.sizeY;
    const zoomX = containerWidth.value / imageWidth;
    const zoomY = containerHeight.value / imageHeight;
    const zoomPercent = 0.9 * Math.min(zoomX, zoomY);

    // ensure the image fills the space
    deckgl.setProps({
        initialViewState: {
            zoom: Math.log2(zoomPercent),
            target: [
                imageWidth / 2 + Math.random() * 0.001, // hack since it will only reset if viewState is different
                // see https://github.com/visgl/deck.gl/issues/8198
                imageHeight / 2 + Math.random() * 0.001,
                0,
            ],
            minZoom: -8,
            maxZoom: 8,
        },
    });
}

const { hoveredTrackId, triggerRecenter } = storeToRefs(
    dataPointSelectionUntrracked
);
watch(hoveredTrackId, renderDeckGL);
watch(triggerRecenter, () => {
    if (!cellMetaData.dataInitialized) return;
    const trackId = dataPointSelection.selectedTrackId;
    if (trackId == null) return;
    const track = cellMetaData.trackMap?.get(trackId);
    if (track == null) return;
    const cell = track.cells.find(
        (cell) =>
            cellMetaData.getFrame(cell) === dataPointSelection.currentFrameIndex
    );
    if (cell == null) return;
    const position = cellMetaData.getPosition(cell);
    position[1] += Math.random() * 0.001; // see https://github.com/visgl/deck.gl/issues/8198
    const zoom = deckgl?.viewState?.ortho?.zoom ?? deckgl?.viewState?.zoom ?? 1;
    deckgl.setProps({
        initialViewState: {
            zoom,
            target: position,
            minZoom: -8,
            maxZoom: 8,
        },
    });

    renderDeckGL();
});

watch(darkMode, renderDeckGL);
watch(currentTrackArray, renderDeckGL);
watch(dataPointSelection.$state, renderDeckGL);
watch(imageViewerStore.$state, renderDeckGL);
watch(contrastLimitSlider, renderDeckGL);
watch(highlightedCellIds, renderDeckGL);
watch(unfilteredTrackIds, renderDeckGL);

function clearSelection() {
    dataPointSelection.selectedTrackId = null;
}
</script>

<template>
    <canvas
        id="super-cool-unique-id"
        ref="deckGlContainer"
        :class="
            dataPointSelectionUntrracked.hoveredTrackId !== null
                ? 'force-default-cursor'
                : ''
        "
        @reset-image-view="resetView"
    ></canvas>
</template>

<style lang="scss">
.force-repeat * {
    background-repeat: repeat;
    // * {background-repeat: norepeat} on css reset is causing
    // slider to not show tick marks
}

.force-default-cursor {
    cursor: default !important;
}
</style>
