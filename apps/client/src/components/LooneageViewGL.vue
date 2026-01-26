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
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import CellSnippetsLayer from './layers/CellSnippetsLayer';
import type { Selection } from './layers/CellSnippetsLayer';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import {
    useLooneageViewStore,
    type SelectedSnippet,
    type InnerHorizonChartSettings,
} from '@/stores/componentStores/looneageViewStore';
import { isEqual } from 'lodash-es';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';

import Pool from '../util/Pool';
import type { Feature } from 'geojson';
import { flextree, type LayoutNode } from 'd3-flextree';
import { hierarchy } from 'd3-hierarchy';
import { format } from 'd3-format';
import colors from '@/util/colors';

import {
    expandHeight,
    getMaxHeight,
    type BBox,
    type BetterBBox,
    getWidth,
    getHeight,
    getBBoxAroundPoint,
    overlaps,
    overlapAmount,
    outerBBox,
    pointInBBox,
    scaleLengthForConstantVisualSize,
} from '@/util/imageSnippets';

import { LRUCache } from 'lru-cache';

import { useKeypress } from 'vue3-keypress';

import {
    loadOmeTiff,
    getChannelStats,
    AdditiveColormapExtension,
} from '@hms-dbmi/viv';

import type { PixelData, PixelSource } from '@vivjs/types';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import {
    GeoJsonLayer,
    LineLayer,
    PathLayer,
    PolygonLayer,
    ScatterplotLayer,
    // SolidPolygonLayer,
    TextLayer,
} from '@deck.gl/layers/typed';

import SnippetSegmentationLayer from './layers/SnippetSegmentationLayer/SnippetSegmentationLayer';
import SnippetSegmentationOutlineLayer from './layers/SnippetSegmentationOutlineLayer/SnippetSegmentationOutlineLayer';

import HorizonChartLayer from './layers/HorizonChartLayer/HorizonChartLayer';
import { useConfigStore } from '@/stores/misc/configStore';
import {
    constructGeometryBase,
    hexListToRgba,
    HORIZON_CHART_MOD_OFFSETS,
    type TemporalDataPoint,
} from './exemplarView/deckglUtil';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const configStore = useConfigStore();
const dataPointSelection = useDataPointSelection();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const { hoveredCellIndex } = storeToRefs(dataPointSelectionUntrracked);
const imageViewerStore = useImageViewerStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const datasetSelectionStore = useDatasetSelectionStore();
const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
const { currentLocationMetadata } = storeToRefs(datasetSelectionStore);
const { contrastLimitSlider } = storeToRefs(imageViewerStoreUntrracked);
const { frameNumber } = storeToRefs(imageViewerStore);
const { selectedTrack, selectedLineage } = storeToRefs(cellMetaData);
const eventBusStore = useEventBusStore();
const segmentationStore = useSegmentationStore();
const looneageViewStore = useLooneageViewStore();
const { spaceKeyframesEvenly, attrKeyList } = storeToRefs(looneageViewStore);
const { darkMode } = storeToRefs(globalSettings);

const shiftDown = ref(false);
useKeypress({
    keyEvent: 'keydown',
    onAnyKey: (e: any) => {
        const event = e.event as KeyboardEvent;
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            onShiftDown();
        }
    },
    keyBinds: [],
});
useKeypress({
    keyEvent: 'keyup',
    onAnyKey: (e: any) => {
        const event = e.event as KeyboardEvent;
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            onShiftUp();
        }
    },
    keyBinds: [],
});
function onShiftDown() {
    shiftDown.value = true;
}

function onShiftUp() {
    shiftDown.value = false;
}

const controlDown = ref(false);
// useKeypress({
//     keyEvent: 'keydown',
//     onAnyKey: (e: any) => {
//         const event = e.event as KeyboardEvent;
//         if (event.metaKey) {
//             onControlDown();
//         }
//     },
//     keyBinds: [],
// });
// useKeypress({
//     keyEvent: 'keyup',
//     onAnyKey: (e: any) => {
//         const event = e.event as KeyboardEvent;
//         if (event.metaKey) {
//             onControlUp();
//         }
//     },
//     keyBinds: [],
// });
// function onControlDown() {
//     controlDown.value = true;
// }

// function onControlUp() {
//     controlDown.value = false;
// }

const deckGlContainer = ref(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

const tree = computed(() => {
    if (cellMetaData.selectedLineage == null) return null;
    return hierarchy<Track | null>(
        cellMetaData.selectedLineage.founder,
        (d: Track | null) => {
            if (d == null) return null;
            if (d.attrNum['generation'] < looneageViewStore.maxDepth) {
                const children: (Track | null)[] = d.children;
                if (looneageViewStore.includeSiblingBuffer) {
                    // insert null into index 1
                    const withBufferNode = [...children];
                    withBufferNode.splice(1, 0, null);
                    return withBufferNode;
                }
                return children;
            }
            return null;
        }
    );
});
function getTimeExtent(track: Track): [number, number] {
    let minTime = track.attrNum['min_time'] ?? 0;
    let maxTime = track.attrNum['max_time'] ?? 0;
    return [minTime, maxTime];
}

function getTimeDuration(track: Track): number {
    let [minTime, maxTime] = getTimeExtent(track);
    return maxTime - minTime;
}

function getTimeDurationForLayout(track: Track): number {
    let [minTime, maxTime] = getTimeExtent(track);
    const parent = cellMetaData.getParent(track);
    if (parent) {
        minTime = parent.attrNum['max_time'];
    }
    return maxTime - minTime;
}

function getTimeOffsetBetweenParentChild(track: Track): number {
    return getTimeDurationForLayout(track) - getTimeDuration(track);
}

const layoutRoot = computed<LayoutNode<Track | null> | null>(() => {
    if (cellMetaData.selectedLineage == null) return null;
    return flextree<Track | null>({
        nodeSize: (node: LayoutNode<Track | null>) => {
            if (node.data == null)
                return [looneageViewStore.rowHeight, cellMetaData.timestep];
            const timeWidth = getTimeDurationForLayout(node.data);
            return [looneageViewStore.rowHeight, timeWidth];
        },
        spacing: looneageViewStore.spacing,
    })(tree.value);
});

const treeBBox = computed<BetterBBox | null>(() => {
    if (layoutRoot.value == null) return null;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (let node of layoutRoot.value.descendants()) {
        if (node.data == null) continue;
        const left = getLeftPosition(node as LayoutNode<Track>);
        const right = getRightPosition(node as LayoutNode<Track>);
        const top = node.x;
        const bottom = node.x - looneageViewStore.rowHeight;
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, bottom);
        maxY = Math.max(maxY, top);
    }

    return { minX, maxX, minY, maxY };
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
    imageViewerStoreUntrracked.initializeContrastLimits(
        channelStats.contrastLimits as [number, number]
    );
    imageViewerStore.contrastLimitExtentSlider.min = channelStats.domain[0];
    imageViewerStore.contrastLimitExtentSlider.max = channelStats.domain[1];

    pixelSource.value = loader.value.data[0] as PixelSource<any>;
    renderDeckGL();
});

eventBusStore.emitter.on('resetLooneageView', resetView);
function resetView() {
    if (deckgl == null) return;
    if (treeBBox.value == null) return;

    // get center
    let { minX, maxX, minY, maxY } = treeBBox.value;
    const x = (minX + maxX) / 2 + Math.random() * 0.00001;
    // Why random? See https://github.com/visgl/deck.gl/issues/8198

    minY -= looneageViewStore.snippetDestSize + getHorizonSnippetPadding();
    const y = (minY + maxY) / 2;

    // get Scale X to fit width
    let zoomX = 1;
    const solverIterations = 10;
    for (let i = 0; i < solverIterations; i++) {
        // zoomX depends on zoomX. We are finding the solution iteratively.
        // Fortunately this converges quickly.
        zoomX =
            deckGlWidth.value /
            (maxX -
                minX +
                (3 * looneageViewStore.snippetDestSize +
                    5 * getBetweenSnippetPaddingXRaw()) /
                    zoomX);
    }

    // transform to log scale
    zoomX = Math.log2(zoomX);

    const newViewState = {
        zoom: [zoomX, 0],
        target: [x, y],
        minZoom: -8,
        maxZoom: 8,
    };
    viewStateMirror.value = newViewState;

    deckgl.setProps({ initialViewState: newViewState });
    renderDeckGL();
}

let deckgl: any | null = null;
const initialViewState = {
    zoom: [0, 0],
    target: [0, 0],
    minZoom: -8,
    maxZoom: 8,
};

const lruCache = new LRUCache({
    max: 250,
});
// this mirror is required because the deckgl viewstate is out of sync by one frame
// when we call renderDeckGL from onViewStateChange
const viewStateMirror = ref(initialViewState);
onMounted(() => {
    deckgl = new Deck({
        initialViewState,
        // @ts-ignore
        canvas: deckGlContainer.value?.id,
        views: new OrthographicView({
            id: 'looneageController',
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
        onViewStateChange: ({ viewState, oldViewState }) => {
            viewState.zoom[1] = 0;
            if (oldViewState && !isEqual(viewState.zoom, oldViewState.zoom)) {
                viewState.target[1] = oldViewState.target[1];
            }
            viewStateMirror.value = viewState as any;
            renderDeckGL();
            return viewState;
        },
        getTooltip: ({ object }) => {
            if (!object) return null;
            const trackId = object.trackId;
            if (trackId == null) return null;
            const time = dataPointSelectionUntrracked.hoveredTime;
            if (time == null) return null;
            const track = cellMetaData.trackMap?.get(trackId);
            if (!track) return null;
            const index = cellMetaData.getCellIndexWithTime(track, time);
            if (index === -1) return null;
            const cell = track.cells[index];
            if (!cell) return null;
            const formatter = format('.2f');
            let html = `<h5>Cell: ${trackId}</h5>`;
            html += `<div>Time: ${formatter(time)}</div>`;
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
        onClick(info, _event) {
            if (!info.object) {
                // canvas was clicked, but no cell object was picked
                dataPointSelection.selectedTrackId = null;
            }
        },
    });
    // renderDeckGL();
});

function constructGeometry(track: Track, key: string): number[] {
    const data: TemporalDataPoint[] = track.cells.map((cell) => {
        return {
            time: cellMetaData.getTime(cell),
            value: cell.attrNum[key],
        };
    });

    return constructGeometryBase(data, cellMetaData.timestep);
}

const lineageMinTime = computed<number>(() => {
    if (!cellMetaData.selectedLineage) return 0;
    return cellMetaData.selectedLineage.founder.attrNum['min_time'];
});

function createConnectingLinesLayer(): PathLayer | null {
    if (!layoutRoot.value?.descendants()) return null;
    const lines = [];
    for (const node of layoutRoot.value.descendants()) {
        if (!node.parent) continue;
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        const childCenter = getMiddleVert(nodeWithData);
        const parentRight = getRightPosition(node.parent);
        const a = [getLeftPosition(nodeWithData), childCenter];
        const b = [parentRight, childCenter];
        const c = [parentRight, getMiddleVert(node.parent)];
        const selected =
            node.parent.data.trackId === dataPointSelection.selectedTrackId ||
            node.data.trackId === dataPointSelection.selectedTrackId;
        lines.push({ path: [a, b, c], selected });
    }
    return new PathLayer({
        id: 'connecting-lines-layer',
        data: lines,
        getPath: (d: any) => d.path,
        getColor: (d: any) =>
            d.selected
                ? globalSettings.normalizedSelectedRgb
                : colors.unselectedBoundary.rgb,
        getWidth: looneageViewStore.connectingLineWidth,
        widthUnits: 'pixels',
        jointRounded: true,
    });
}

function createTickMarksLayer(): PathLayer | null {
    if (!layoutRoot.value?.descendants()) return null;
    const height = getTickmarkHeight();
    const spaceThreshold = minTickMarkSpace();
    const lines = [];
    let lastX = null;
    for (const node of layoutRoot.value.descendants()) {
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        if (!horizonInViewport(nodeWithData)) continue;
        for (const cell of node.data.cells) {
            const x =
                getLeftPosition(nodeWithData) +
                cellMetaData.getTime(cell) -
                node.data.attrNum['min_time'];
            if (lastX !== null) {
                if (Math.abs(x - lastX) < spaceThreshold) return null;
                // If the points are too close together,
                // skip rendering, it is worse visually and
                // is a performance hit.
            }
            lastX = x;
            const bottom = node.x + height;
            const top = node.x - height - looneageViewStore.rowHeight;
            const a = [x, bottom];
            const b = [x, top];
            lines.push([a, b]);
        }
    }
    return new PathLayer({
        id: 'horizon-tick-marks-layer',
        data: lines,
        getPath: (d: any) => d,
        getColor: darkMode.value ? [100, 100, 100] : [180, 180, 180],
        getWidth: getTickmarkWidth(),
        widthUnits: 'pixels',
    });
}

function createHorizonChartLayers(): (
    | ScatterplotLayer
    | HorizonChartLayer
    | PolygonLayer
    | TextLayer
    | null
)[] {
    if (!cellMetaData.selectedLineage) return [];
    // if (!segmentationData.value) return [];
    if (!layoutRoot.value?.descendants()) return [];
    const layers: (
        | ScatterplotLayer
        | HorizonChartLayer
        | PolygonLayer
        | TextLayer
        | null
    )[] = [];
    const pickingLayer: {
        destination: [number, number, number, number];
        trackId: string;
    }[] = [];
    let labelsPlaced = false;
    for (let node of layoutRoot.value.descendants()) {
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        for (
            let i = 0;
            i < looneageViewStore.horizonChartSettingList.length;
            i++
        ) {
            const horizonChartSettings =
                looneageViewStore.horizonChartSettingList[i];
            layers.push(
                createHorizonChartLayer(
                    nodeWithData,
                    horizonChartSettings,
                    i,
                    looneageViewStore.horizonChartSettingList.length
                )
            );
        }
        if (!labelsPlaced) {
            const labelLayer = createHorizonChartLabelLayer(nodeWithData);
            if (labelLayer) {
                layers.push(labelLayer);
                labelsPlaced = true;
            }
        }

        const track = node.data;
        let left = getLeftPosition(nodeWithData);
        let width = getTimeDuration(track);
        if (width === 0) {
            width = cellMetaData.timestep;
            left -= width / 2;
        }
        const destination: [number, number, number, number] = [
            node.x,
            left,
            width,
            looneageViewStore.rowHeight,
        ];
        pickingLayer.push({ destination, trackId: track.trackId });
    }
    const destinationLayer = new PolygonLayer({
        id: 'destination-rectangle-layer',
        data: pickingLayer,
        pickable: true,
        getPolygon: (pickingData: {
            destination: [number, number, number, number];
            trackId: string;
        }) => {
            const d = pickingData.destination;
            return [
                [d[1], d[0]],
                [d[1] + d[2], d[0]],
                [d[1] + d[2], d[0] - d[3]],
                [d[1], d[0] - d[3]],
            ];
        },
        getFillColor: [255, 0, 255, 0],
        getLineColor: (d) =>
            d.trackId === dataPointSelectionUntrracked.hoveredTrackId
                ? colors.hovered.rgb
                : globalSettings.normalizedSelectedRgb,
        getLineWidth: (d: any) => {
            if (d.trackId === dataPointSelectionUntrracked.hoveredTrackId) {
                return 5;
            } else if (d.trackId === dataPointSelection.selectedTrackId) {
                return 3;
            } else {
                return 0;
            }
        },
        lineWidthUnits: 'pixels',
        onHover: (info: PickingInfo) => {
            if (!cellMetaData.trackMap) return;
            const { selectedSnippet, time } = processHorizonPickingInfo(info);
            if (isEqual(selectedSnippet, hoveredSnippet.value)) return;
            dataPointSelectionUntrracked.hoveredTime = time;
            hoveredSnippet.value = selectedSnippet;
            dataPointSelectionUntrracked.hoveredTrackId =
                selectedSnippet?.trackId ?? null;
            renderDeckGL();
        },
        onClick: (info: PickingInfo) => {
            if (!cellMetaData.trackMap) return;
            let { selectedSnippet, time } = processHorizonPickingInfo(info);
            if (time !== null) {
                dataPointSelection.setCurrentFrameIndex(time);
            }
            if (!selectedSnippet) return;
            dataPointSelection.selectedTrackId = selectedSnippet.trackId;
            dataPointSelectionUntrracked.setTriggerRecenter();
            if (!controlDown.value) return;
            if (shiftDown.value) {
                selectedSnippet =
                    looneageViewStore.concealPinnedSnippet(selectedSnippet);
            } else {
                selectedSnippet =
                    looneageViewStore.revealPinnedSnippet(selectedSnippet);
            }
            if (selectedSnippet) {
                hoveredSnippet.value = { ...selectedSnippet };
                hoveredSnippet.value.extraFrames += 1;
            } else if (hoveredSnippet.value) {
                hoveredSnippet.value.extraFrames = 0;
            }
            renderDeckGL();
        },
    });
    layers.push(destinationLayer);

    return layers;
}

interface HorizonPickingResult {
    selectedSnippet: SelectedSnippet | null;
    time: number | null;
}

function processHorizonPickingInfo(info: PickingInfo): HorizonPickingResult {
    const result: HorizonPickingResult = { selectedSnippet: null, time: null };
    if (!cellMetaData.trackMap) return result;
    if (!info.picked) {
        result.time = null;
        result.selectedSnippet = null;
        return result;
    }
    const xPos = info.coordinate?.[0] ?? null;
    const newTime =
        xPos !== null
            ? cellMetaData.getClosestTime(xPos + lineageMinTime.value)
            : null;
    result.time = newTime;

    const trackId = info.object.trackId;
    const track = cellMetaData.trackMap.get(trackId);
    if (!track) {
        console.error('track not found when hovering');
        return result;
    }
    const index = cellMetaData.getCellIndexWithTime(track, newTime);
    result.selectedSnippet = {
        trackId,
        index,
        extraFrames: 0,
    };
    return result;
}

const hoveredSnippet = ref<SelectedSnippet | null>(null);
watch(hoveredCellIndex, () => {
    if (
        dataPointSelectionUntrracked.hoveredTrackId === null ||
        hoveredCellIndex.value === null
    ) {
        hoveredSnippet.value = null;
        return;
    }
    hoveredSnippet.value = {
        trackId: dataPointSelectionUntrracked.hoveredTrackId,
        index: hoveredCellIndex.value,
        extraFrames: 0,
    };
});
// watch(hoveredSnippet, () => {
//     hoveredCellIndex.value = hoveredSnippet.value?.index ?? null;
// });
// Circular watch

function getLeftPosition(node: LayoutNode<Track>): number {
    return node.y + getTimeOffsetBetweenParentChild(node.data);
}

function getRightPosition(node: LayoutNode<Track>): number {
    return getLeftPosition(node) + getTimeDuration(node.data);
}

function getMiddleVert(node: LayoutNode<Track>): number {
    return node.x - looneageViewStore.rowHeight / 2;
}

interface TickData {
    path: [number, number][];
    hovered: boolean;
    pinned: boolean;
    drawerLine: boolean;
}

interface SnippetRenderInfo {
    node: LayoutNode<Track>;
    displayBelow: boolean;
}

interface SnippetCellInfo {
    cell: Cell;
    destinationBottomLeft: [number, number];
    hovered: boolean;
}

interface KeyFrameSnippetsResult {
    snippetCellInfo: SnippetCellInfo[];
    imageLayer: CellSnippetsLayer | null;
    snippetTickLayer: PathLayer | null;
    hoverLayer: CellSnippetsLayer | null;
    pickingLayer: PolygonLayer;
}

function createKeyFrameSnippets(): KeyFrameSnippetsResult | null {
    if (!layoutRoot.value) return null;
    // used for collision detection, to prevent overlapping. The logic
    // is slightly different for the horizon charts and the user selected
    // snippets, which include hovered and pinned snippets
    const occupied: BBox[] = [];
    const userSelectedSnippetBBoxes: BBox[] = [];

    // set up a few variables that will be used in the loops
    const destWidth = scaleForConstantVisualSize(
        looneageViewStore.snippetDestSize,
        'x'
    );

    const destHeight = scaleForConstantVisualSize(
        looneageViewStore.snippetDestSize,
        'y'
    );

    const tickPadding = getHorizonSnippetPadding();
    const aboveOffset = looneageViewStore.rowHeight + tickPadding;
    const belowOffset = destHeight + tickPadding;

    const trackIdToRenderInfo = new Map<string, SnippetRenderInfo>();
    // this is needed to keep track of render info, so that user selected
    // snippets can be added after the auto selected snippets on the correct
    // side (above/below)

    // add horizon chart as occupied rectangle
    for (let node of layoutRoot.value.descendants()) {
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        trackIdToRenderInfo.set(nodeWithData.data.trackId, {
            node: nodeWithData,
            displayBelow: false,
        });
        if (!horizonInViewport(nodeWithData)) continue; // for performance
        const left = getLeftPosition(nodeWithData);
        const right = getRightPosition(nodeWithData);
        const chartBBox: BBox = [
            left,
            node.x,
            right,
            node.x - looneageViewStore.rowHeight,
        ];
        occupied.push(chartBBox);
    }

    // get snippet placement for each horizon chart. All snippets will be placed
    // on the same side of the chart. Find the side with more free space, and prefer
    // the top in  at tie. This calculation should be done before the user selected snippets
    // it is jarring if hovering/selecting  causes the side to change.
    const selections: Selection[] = [];
    const hoverSelections: Selection[] = [];
    const snippetCellInfo: SnippetCellInfo[] = [];
    const addSelection = (selection: Selection, collection: Selection[]) => {
        const matchingSelection = collection.find(
            (s) =>
                s.c === selection.c &&
                s.z === selection.z &&
                s.t === selection.t
        );
        if (matchingSelection) {
            matchingSelection.snippets.push(...selection.snippets);
        } else {
            collection.push(selection);
        }
    };

    const snippetPickingData: {
        trackId: string;
        index: number;
        destination: BBox;
    }[] = [];

    const ticks: TickData[] = [];
    for (let node of layoutRoot.value.descendants()) {
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        if (!horizonInViewport(nodeWithData)) continue; // for performance

        const centeredBBox: BBox = [
            getLeftPosition(nodeWithData) - destWidth / 2,
            node.x,
            getRightPosition(nodeWithData) + destHeight / 2,
            node.x - destHeight,
        ];
        const aboveBBox: BBox = [...centeredBBox];
        aboveBBox[1] -= aboveOffset;
        aboveBBox[3] -= aboveOffset;
        const belowBBox: BBox = [...centeredBBox];
        belowBBox[1] += belowOffset;
        belowBBox[3] += belowOffset;

        let aboveOverlap = 0;
        let belowOverlap = 0;
        for (const bbox of occupied) {
            aboveOverlap += overlapAmount(aboveBBox, bbox);
            belowOverlap += overlapAmount(belowBBox, bbox);
        }
        const displayBelow = aboveOverlap > belowOverlap;
        // preffer to display above
        // but if there is moe overlap above then place below
        const track = node.data;
        const renderInfo = trackIdToRenderInfo.get(track.trackId);
        if (renderInfo) {
            renderInfo.displayBelow = displayBelow;
        }
    }

    // add pinned snippets to user selected, and selections
    for (const snippet of Object.values(looneageViewStore.pinnedSnippets)) {
        const track = cellMetaData.trackMap?.get(snippet.trackId);
        if (!track) continue;
        const renderInfo = trackIdToRenderInfo.get(track.trackId);
        if (!renderInfo) {
            console.error('could not find render info');
            continue;
        }
        let outerPinnedBBox: BBox | null = null;
        const { displayBelow, node } = renderInfo;
        for (
            let indexOffset = -snippet.extraFrames;
            indexOffset <= snippet.extraFrames;
            indexOffset++
        ) {
            let index = snippet.index + indexOffset;
            index = Math.max(index, 0);
            index = Math.min(index, track.cells.length - 1);
            const cell = track.cells[index];
            let frameIndex = cellMetaData.getFrame(cell) - 1; // convert frame number to index
            // account for offset if past first/last frame
            const edgeIndexOffset = snippet.index + indexOffset - index;
            frameIndex += snippet.index + indexOffset - index;
            if (
                frameIndex < 0 ||
                frameIndex >= imageViewerStoreUntrracked.sizeT
            ) {
                continue;
            }
            const pinnedBbox = getSnippetBBox(
                snippet.index,
                node,
                displayBelow,
                aboveOffset,
                belowOffset,
                destWidth,
                destHeight,
                indexOffset
            );
            if (
                !overlaps(
                    pinnedBbox,
                    viewportBBox(),
                    getBetweenSnippetPaddingX(),
                    getBetweenSnippetPaddingY()
                )
            )
                continue;

            if (outerPinnedBBox === null) {
                outerPinnedBBox = [...pinnedBbox];
            } else {
                outerPinnedBBox = outerBBox(outerPinnedBBox, pinnedBbox);
            }

            const [x, y] = cellMetaData.getPosition(cell);
            const source = getBBoxAroundPoint(
                x,
                y,
                looneageViewStore.snippetSourceSize,
                looneageViewStore.snippetSourceSize
            );
            addSelection(
                {
                    c: imageViewerStore.selectedChannel,
                    z: 0,
                    t: frameIndex,
                    snippets: [{ source, destination: pinnedBbox }],
                },
                selections
            );
            if (edgeIndexOffset === 0) {
                // add for the cell boundary only if snippet is within track bounds
                snippetCellInfo.push({
                    cell,
                    destinationBottomLeft: [pinnedBbox[0], pinnedBbox[1]],
                    hovered: false,
                });
            }
            snippetPickingData.push({
                trackId: track.trackId,
                index: snippet.index,
                destination: pinnedBbox,
            });
            const tickData = getTickData(
                node,
                index,
                cell,
                tickPadding,
                displayBelow,
                false,
                true,
                edgeIndexOffset,
                indexOffset ? true : false
            );
            ticks.push(tickData);
        }
        if (outerPinnedBBox) {
            userSelectedSnippetBBoxes.push(outerPinnedBBox);
            if (snippet.extraFrames > 0) {
                const windowDrawerData = getWindowDrawer(
                    outerPinnedBBox,
                    displayBelow
                );
                ticks.push(windowDrawerData);
            }
        }
    }

    // add the hovered snippet to render, and to collisions
    if (hoveredSnippet.value && cellMetaData.trackMap != null) {
        const trackId = hoveredSnippet.value.trackId;
        const renderInfo = trackIdToRenderInfo.get(trackId);
        if (renderInfo) {
            let outerHoveredBBox: BBox | null = null;
            const { displayBelow, node } = renderInfo;
            for (
                let indexOffset = -hoveredSnippet.value.extraFrames;
                indexOffset <= hoveredSnippet.value.extraFrames;
                indexOffset++
            ) {
                const track = node.data;

                let index = hoveredSnippet.value.index + indexOffset;
                index = Math.max(index, 0);
                index = Math.min(index, track.cells.length - 1);

                // add hovered image snippet to selections
                const cell = track.cells[index];
                let frameIndex = cellMetaData.getFrame(cell) - 1; // convert frame number to index
                // account for offset if past first/last frame
                const edgeIndexOffset =
                    hoveredSnippet.value.index + indexOffset - index;
                frameIndex += hoveredSnippet.value.index + indexOffset - index;
                if (
                    frameIndex < 0 ||
                    frameIndex >= imageViewerStoreUntrracked.sizeT
                ) {
                    continue;
                }
                const hoveredBBox = getSnippetBBox(
                    hoveredSnippet.value.index,
                    node,
                    displayBelow,
                    aboveOffset,
                    belowOffset,
                    destWidth,
                    destHeight,
                    indexOffset
                );
                if (outerHoveredBBox === null) {
                    outerHoveredBBox = [...hoveredBBox];
                } else {
                    outerHoveredBBox = outerBBox(outerHoveredBBox, hoveredBBox);
                }

                const [x, y] = cellMetaData.getPosition(cell);
                const source = getBBoxAroundPoint(
                    x,
                    y,
                    looneageViewStore.snippetSourceSize,
                    looneageViewStore.snippetSourceSize
                );
                const destination = hoveredBBox;
                addSelection(
                    {
                        c: imageViewerStore.selectedChannel,
                        z: 0,
                        t: frameIndex,
                        snippets: [{ source, destination }],
                    },
                    hoverSelections
                );
                if (edgeIndexOffset === 0) {
                    // add for the cell boundary only if snippet is within track bounds
                    snippetCellInfo.push({
                        cell,
                        destinationBottomLeft: [hoveredBBox[0], hoveredBBox[1]],
                        hovered: true,
                    });
                }
                snippetPickingData.push({
                    trackId: track.trackId,
                    index: hoveredSnippet.value.index,
                    destination,
                });

                // add tick mark for hovered snippet
                const tickData = getTickData(
                    node,
                    index,
                    cell,
                    tickPadding,
                    displayBelow,
                    true,
                    false,
                    edgeIndexOffset,
                    indexOffset ? true : false
                );
                ticks.push(tickData);
            }
            if (outerHoveredBBox) {
                userSelectedSnippetBBoxes.push(outerHoveredBBox);
                if (hoveredSnippet.value.extraFrames > 0) {
                    const windowDrawerData = getWindowDrawer(
                        outerHoveredBBox,
                        displayBelow
                    );
                    ticks.push(windowDrawerData);
                }
            }
        }
    }

    // add the automatic snippets, avoiding horizons and user selected snippets
    for (const node of layoutRoot.value.descendants()) {
        if (node.data === null) continue;
        const nodeWithData = node as LayoutNode<Track>;
        const track = node.data;
        const renderInfo = trackIdToRenderInfo.get(track.trackId);
        if (!renderInfo) {
            console.error('could not find render info');
            continue;
        }
        const { displayBelow } = renderInfo;
        const keyframeOrder = getKeyFrameOrder(node.data);
        let newSnippetsOuterBBox: BBox | null = null;

        for (const { index, nearestDistance } of keyframeOrder) {
            // exit loop if this point would overlap existing points
            if (nearestDistance <= destWidth + getBetweenSnippetPaddingX()) {
                break;
            }
            const destination: BBox = getSnippetBBox(
                index,
                nodeWithData,
                displayBelow,
                aboveOffset,
                belowOffset,
                destWidth,
                destHeight
            );

            if (
                !overlaps(
                    destination,
                    viewportBBox(),
                    getBetweenSnippetPaddingX(),
                    getBetweenSnippetPaddingY()
                ) ||
                occupied.some((bbox: BBox) =>
                    overlaps(
                        bbox,
                        destination,
                        getBetweenSnippetPaddingX(),
                        getBetweenSnippetPaddingY()
                    )
                ) ||
                userSelectedSnippetBBoxes.some((bbox: BBox) =>
                    overlaps(
                        bbox,
                        destination,
                        getBetweenSnippetPaddingX(),
                        getBetweenSnippetPaddingY()
                    )
                )
            ) {
                // this overlaps with existing occupied spaces, do not
                // add this snippet to render, but continue adding the
                // next keyframes until the distance is low enough.
                continue;
            }

            // update this track's snippets outer bounding box
            if (newSnippetsOuterBBox === null) {
                newSnippetsOuterBBox = [...destination];
            } else {
                newSnippetsOuterBBox = outerBBox(
                    newSnippetsOuterBBox,
                    destination
                );
            }

            const cell = track.cells[index];
            const [x, y] = cellMetaData.getPosition(cell);
            const source = getBBoxAroundPoint(
                x,
                y,
                looneageViewStore.snippetSourceSize,
                looneageViewStore.snippetSourceSize
            );
            addSelection(
                {
                    c: imageViewerStore.selectedChannel,
                    z: 0,
                    t: cellMetaData.getFrame(cell) - 1, // convert frame number to index
                    snippets: [{ source, destination }],
                },
                selections
            );
            snippetCellInfo.push({
                cell,
                destinationBottomLeft: [destination[0], destination[1]],
                hovered: false,
            });
            snippetPickingData.push({
                trackId: track.trackId,
                index,
                destination,
            });
            const tickData = getTickData(
                nodeWithData,
                index,
                cell,
                tickPadding,
                displayBelow,
                false,
                false
            );
            ticks.push(tickData);
        }
        if (newSnippetsOuterBBox !== null) {
            occupied.push(newSnippetsOuterBBox);
        }
    }

    // create the actual layers now the data is generated
    const snippetTickMarksLayer = new PathLayer({
        id: 'snippet-tick-marks-layer',
        data: ticks,
        getPath: (d: any) => d.path,
        getColor: (d: any) => {
            if (d.hovered | d.pinned) {
                return [130, 145, 170, 200];
            } else if (d.drawerLine) {
                if (globalSettings.darkMode) {
                    return [195, 217, 250, 200];
                } else {
                    return [65, 72, 85, 200];
                }
            } else {
                return [130, 145, 170, 150];
            }
        },
        getWidth: (d: any) => (d.hovered ? 3 : 1.5),
        widthUnits: 'pixels',
        capRounded: false,
    });
    const snippetLayer = new CellSnippetsLayer({
        loader: pixelSource.value,
        id: `key-frames-snippets-layer`,
        contrastLimits: contrastLimit.value,
        selections,
        channelsVisible: [true],
        extensions: [colormapExtension],
        colormap: imageViewerStore.colormap,
        cache: lruCache,
    });

    let hoverLayer = null;
    if (hoverSelections.length > 0) {
        hoverLayer = new CellSnippetsLayer({
            loader: pixelSource.value,
            id: `hovered-snippets-layer`,
            contrastLimits: contrastLimit.value,
            selections: hoverSelections,
            channelsVisible: [true],
            extensions: [colormapExtension],
            colormap: imageViewerStore.colormap,
            cache: lruCache,
        });
    }

    const snippetPickingLayer = new PolygonLayer({
        id: 'snippet-picking-layer',
        data: snippetPickingData,
        pickable: true,
        getPolygon: (pickingData: {
            destination: [number, number, number, number]; // left, top, right, bottom
            trackId: string;
            index: number;
        }) => {
            const d = pickingData.destination;
            return [
                [d[0], d[1]],
                [d[2], d[1]],
                [d[2], d[3]],
                [d[0], d[3]],
            ];
        },
        getFillColor: [255, 0, 255, 0],
        getLineColor: colors.hovered.rgb,
        getLineWidth: (d: any) => {
            if (
                !looneageViewStore.showSnippetOutline &&
                hoveredSnippet.value?.trackId === d.trackId &&
                hoveredSnippet.value?.index === d.index
            ) {
                // only show hover outline if not showing snippet outline
                return 3;
            }
            return 0;
        },

        lineWidthUnits: 'pixels',
        onHover: (info: PickingInfo) => {
            if (!cellMetaData.trackMap) return;
            if (!info.picked) {
                hoveredSnippet.value = null;
                dataPointSelectionUntrracked.hoveredTime = null;
                renderDeckGL();
                return;
            }
            const { trackId, index } = info.object;
            let selectedSnippet = looneageViewStore.getSnippet(trackId, index);

            const track = cellMetaData.trackMap.get(trackId);
            if (!track) return;
            const cell = track.cells[index];
            const time = cellMetaData.getTime(cell);
            dataPointSelectionUntrracked.hoveredTime = time;
            if (!selectedSnippet) {
                // not currently pinned auto placed snippet
                selectedSnippet = {
                    trackId,
                    index,
                    extraFrames: 1,
                };
                hoveredSnippet.value = selectedSnippet;
                dataPointSelectionUntrracked.hoveredTime = null;
                renderDeckGL();
                return;
            }
            if (isEqual(selectedSnippet, hoveredSnippet.value)) return;
            hoveredSnippet.value = { ...selectedSnippet };
            if (hoveredSnippet.value) {
                const matchingPinnedSnippet =
                    looneageViewStore.getMatchingPinnedSnippet(
                        hoveredSnippet.value
                    );
                if (matchingPinnedSnippet) {
                    hoveredSnippet.value.extraFrames =
                        matchingPinnedSnippet.extraFrames + 1;
                }
            }

            renderDeckGL();
        },
        onClick: (info: PickingInfo) => {
            if (!cellMetaData.trackMap) return;
            const { trackId, index } = info.object;
            let selectedSnippet = looneageViewStore.getSnippet(trackId, index);
            if (!selectedSnippet) {
                // not currently pinned a auto placed snippet
                selectedSnippet = {
                    trackId,
                    index,
                    extraFrames: 1,
                };
            }
            if (shiftDown.value) {
                selectedSnippet =
                    looneageViewStore.concealPinnedSnippet(selectedSnippet);
            } else {
                selectedSnippet =
                    looneageViewStore.revealPinnedSnippet(selectedSnippet);
            }
            if (selectedSnippet) {
                hoveredSnippet.value = { ...selectedSnippet };
            } else if (hoveredSnippet.value) {
                hoveredSnippet.value = null;
            }
            renderDeckGL();
        },
    });

    return {
        snippetCellInfo,
        imageLayer: snippetLayer,
        snippetTickLayer: snippetTickMarksLayer,
        hoverLayer,
        pickingLayer: snippetPickingLayer,
    };
}

function getSnippetBBox(
    index: number,
    node: LayoutNode<Track>,
    displayBelow: boolean,
    aboveOffset: number,
    belowOffset: number,
    destWidth: number,
    destHeight: number,
    indexOffset?: number
): BBox {
    let destY = node.x;
    if (displayBelow) {
        destY += belowOffset;
    } else {
        destY -= aboveOffset;
    }
    const track = node.data;
    const cell = track.cells[index];
    if (cell == null) {
        console.error('cell is null, can not get bbox');
        console.error({ index, track });
        return [0, 0, 0, 0];
    }
    const t = cellMetaData.getTime(cell);

    let destX =
        getLeftPosition(node) + t - track.attrNum['min_time'] - destWidth / 2;
    if (indexOffset) {
        const offsetT = getOffsetTime(track, index, indexOffset);
        const evenDestX =
            destX + indexOffset * (destWidth + getBetweenSnippetPaddingX());
        const realDestX = destX + offsetT - t;
        if (indexOffset > 0) {
            destX = Math.max(evenDestX, realDestX);
        } else {
            destX = Math.min(evenDestX, realDestX);
        }
    }
    return [destX, destY, destX + destWidth, destY - destHeight];
}

function getTickData(
    node: LayoutNode<Track>,
    cellIndex: number,
    cell: Cell,
    tickPadding: number,
    displayBelow: boolean,
    hovered: boolean,
    pinned: boolean,
    indexOffset?: number,
    bufferTick = false
): TickData {
    let tickX = getLeftPosition(node) - node.data.attrNum['min_time'];
    let t = cellMetaData.getTime(cell);
    if (indexOffset) {
        t = getOffsetTime(node.data, cellIndex, indexOffset);
    }
    tickX += t;
    let tickSnippetY = node.x;
    let tickHorizonY = node.x;
    if (displayBelow) {
        tickSnippetY += tickPadding;
        tickHorizonY -= looneageViewStore.rowHeight;
        if (bufferTick) {
            tickSnippetY -= getSnippetDrawerLinePadding();
        } else {
            tickSnippetY += looneageViewStore.snippetDestSize / 2.0;
        }
    } else {
        tickSnippetY -= looneageViewStore.rowHeight + tickPadding;
        if (bufferTick) {
            tickSnippetY += getSnippetDrawerLinePadding();
        } else {
            tickSnippetY -= looneageViewStore.snippetDestSize / 2.0;
        }
    }
    return {
        path: [
            [tickX, tickSnippetY],
            [tickX, tickHorizonY],
        ],
        hovered,
        pinned,
        drawerLine: false,
    };
}

function getWindowDrawer(outerBBox: BBox, displayBelow: boolean): TickData {
    const [left, top, right, bottom] = outerBBox;
    const x1 = left - getBetweenSnippetPaddingX() / 2.0;
    const x2 = right + getBetweenSnippetPaddingX() / 2.0;
    let y1;
    let y2;
    if (displayBelow) {
        y1 = bottom - getSnippetDrawerLinePadding();
        y2 = y1 + 2 * getSnippetDrawerLinePadding();
    } else {
        y1 = top + getSnippetDrawerLinePadding();
        y2 = y1 - 2 * getSnippetDrawerLinePadding();
    }

    return {
        path: [
            [x1, y2],
            [x1, y1],
            [x2, y1],
            [x2, y2],
        ],
        hovered: false,
        pinned: false,
        drawerLine: true,
    };
}

function getOffsetTime(
    track: Track,
    cellIndex: number,
    offset: number
): number {
    const offsetCellIndex = cellIndex + offset;
    if (offsetCellIndex < 0 || offsetCellIndex >= track.cells.length) {
        const cell = track.cells[cellIndex];
        const t = cellMetaData.getTime(cell);
        const i = cellMetaData.timeList.findIndex((time) => time === t);
        if (i === -1) {
            console.error('could not find time in timeList');
            return -1;
        } else {
            return cellMetaData.timeList[i + offset];
        }
    } else {
        const cell = track.cells[offsetCellIndex];
        return cellMetaData.getTime(cell);
    }
}

function valueExtent(track: Track, key: string): number {
    let min = Infinity;
    let max = -Infinity;
    for (let cell of track.cells) {
        min = Math.min(min, cell.attrNum[key]);
        max = Math.max(max, cell.attrNum[key]);
    }
    return max - min;
}

function getHorizonSnippetPadding(): number {
    return scaleForConstantVisualSize(9, 'y');
}

function getTickmarkHeight(): number {
    return scaleForConstantVisualSize(3, 'y');
}

function getTickmarkWidth(): number {
    return 2; // expects pixel units
}

function minTickMarkSpace(): number {
    return scaleForConstantVisualSize(4.5, 'x');
}

function getSnippetDrawerLinePadding(): number {
    return scaleForConstantVisualSize(3, 'y');
}

function getBetweenSnippetPaddingXRaw(): number {
    return 8;
}
function getBetweenSnippetPaddingX(): number {
    return scaleForConstantVisualSize(getBetweenSnippetPaddingXRaw(), 'x');
}

function getBetweenSnippetPaddingY(): number {
    return scaleForConstantVisualSize(8, 'y');
}

interface KeyframeInfo {
    index: number;
    nearestDistance: number;
}

watch(attrKeyList, () => {
    keyframeOrderLookup.value = new Map();
    renderDeckGL();
});
watch(spaceKeyframesEvenly, () => {
    keyframeOrderLookup.value = new Map();
    renderDeckGL();
});
watch(datasetSelectionTrrackedStore.$state, () => {
    keyframeOrderLookup.value = new Map();
});
const keyframeOrderLookup = ref<Map<string, KeyframeInfo[]>>();
function getKeyFrameOrder(track: Track): KeyframeInfo[] {
    if (keyframeOrderLookup.value == null) {
        keyframeOrderLookup.value = new Map();
    }
    if (keyframeOrderLookup.value.has(track.trackId)) {
        return keyframeOrderLookup.value.get(track.trackId) as KeyframeInfo[];
    }

    // initialize scores based on the change in the attribute value
    // the first and last frames should always be
    // selected as key frames, so they get a score of zero.
    const frameScores: number[] = Array(track.cells.length).fill(0);
    frameScores[0] = Infinity;
    frameScores[track.cells.length - 1] = Infinity;
    if (!spaceKeyframesEvenly.value) {
        const numDim = looneageViewStore.horizonChartSettingList.length;
        for (let setting of looneageViewStore.horizonChartSettingList) {
            const key = setting.attrKey;
            const valExtent = valueExtent(track, setting.attrKey);
            if (valExtent === 0) {
                // avoid divide by zero, if vall extent is zero, then all
                // values are the same, so the scores should be equal.
                continue;
            }
            for (let i = 1; i < track.cells.length - 1; i++) {
                const prev = track.cells[i - 1];
                const next = track.cells[i + 1];
                const val =
                    Math.abs(next.attrNum[key] - prev.attrNum[key]) / valExtent;
                frameScores[i] += val / numDim;
            }
        }
    }

    const frameDistances: number[] = Array(track.cells.length).fill(Infinity);

    const center = 1;
    const dropOff = 3;
    const keyframeOrder: KeyframeInfo[] = [];
    const timeExtent = getTimeDuration(track);
    for (let i = 0; i < track.cells.length; i++) {
        let maxIndex = -1;
        let maxScore = -Infinity;
        for (let i = 0; i < frameScores.length; i++) {
            if (frameDistances[i] === 0) continue;
            let coverageCost;
            if (frameDistances[i] === Infinity || timeExtent === 0) {
                coverageCost = 0;
            } else {
                const distNorm = (200 * frameDistances[i]) / timeExtent;
                coverageCost =
                    (-center * (distNorm - dropOff)) /
                        (center + Math.abs(distNorm - dropOff)) +
                    center;
            }
            const score = frameScores[i] - coverageCost;
            if (score > maxScore) {
                maxScore = score;
                maxIndex = i;
            }
        }
        keyframeOrder.push({
            index: maxIndex,
            nearestDistance: frameDistances[maxIndex],
        });

        // update the nearest distance values
        if (maxIndex === -1) {

        }
        const t1 = cellMetaData.getTime(track.cells[maxIndex]);

        // TODO: make d relative to tExtent, likely will have to update coverage function
        for (let i = maxIndex; i < frameDistances.length; i++) {
            const t2 = cellMetaData.getTime(track.cells[i]);
            const d = Math.abs(t1 - t2);
            if (frameDistances[i] < d) break;
            frameDistances[i] = d;
        }
        for (let i = maxIndex; i >= 0; i--) {
            const t2 = cellMetaData.getTime(track.cells[i]);
            const d = Math.abs(t1 - t2);
            if (frameDistances[i] < d) break;
            frameDistances[i] = d;
        }
    }
    keyframeOrderLookup.value.set(track.trackId, keyframeOrder);
    return keyframeOrder;
}

const viewportBuffer = computed<number>(() => {
    // somewhat arbitrary buffer for viewport rendering filtering
    // for performance. Probably makes sense for this to depend
    // on the snippet destination size that way the number of
    // snippets "preloaded" around edges is constant.
    return looneageViewStore.snippetDestSize;
});

function pointInViewport(x: number, y: number, includeBuffer = true): boolean {
    const viewport: BBox = viewportBBox(includeBuffer);
    return pointInBBox(x, y, viewport);
}

function horizonInViewport(
    node: LayoutNode<Track>,
    includeBuffer = true
): boolean {
    const chartBBox: BBox = [
        getLeftPosition(node),
        node.x,
        getRightPosition(node),
        node.x - looneageViewStore.rowHeight,
    ];
    return overlaps(
        chartBBox,
        viewportBBox(includeBuffer),
        getBetweenSnippetPaddingX(),
        getBetweenSnippetPaddingY()
    );
}

function createHorizonChartLabelLayer(
    node: LayoutNode<Track>
): TextLayer | null {
    if (!cellMetaData.selectedLineage) return null;
    const dimCount = looneageViewStore.horizonChartSettingList.length;
    const innerHeight = looneageViewStore.rowHeight / dimCount;
    const fontSize = 12;
    if (innerHeight < fontSize + 2) return null;
    const track = node.data;
    const viewportLeft = viewportBBox(false)[0];
    let nodeLeft = getLeftPosition(node);
    let left =
        Math.max(nodeLeft, viewportLeft) + scaleForConstantVisualSize(5, 'x');

    let width = getTimeDuration(track);
    if (nodeLeft < viewportLeft) {
        // horizon is partially offscreen, width should be only the width on screen
        width -= viewportLeft - nodeLeft;
    }
    const maxCharacters = looneageViewStore.horizonChartSettingList
        .map((x) => x.attrKey.length)
        .reduce((a, b) => Math.max(a, b), 0);
    const fakeTextWidth = scaleForConstantVisualSize(10 * maxCharacters, 'x');
    // this is just an estimate, not the measured width
    if (width < fakeTextWidth) {
        return null;
    }
    if (!horizonInViewport(node, false)) {
        return null;
    }

    const labelData = [];
    for (let i = 0; i < looneageViewStore.horizonChartSettingList.length; i++) {
        const settings = looneageViewStore.horizonChartSettingList[i];
        const bottom = node.x - innerHeight * (dimCount - i - 1);
        labelData.push({ text: settings.attrKey, position: [left, bottom] });
        if (!pointInViewport(left, bottom, false)) {
            return null;
        }
        if (!pointInViewport(left, bottom - fontSize, false)) {
            return null;
        }
    }
    const textLayer = new TextLayer({
        id: `horizon-chart-label-layer`,
        data: labelData,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.text,
        getSize: fontSize,
        getAngle: 0,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'bottom',
        getColor: [0, 0, 0, 255],
        // fontSettings: { sdf: true },
        // outlineColor: [255, 255, 255, 255],
        // outlineWidth: 4,
        backgroundPadding: [5, 2],
        background: true,
        backgroundColor: [255, 255, 255, 160],
    });

    return textLayer;
}

function createHorizonChartLayer(
    node: LayoutNode<Track>,
    settings: InnerHorizonChartSettings,
    dimIndex: number, // the 0-based index of the attribute dimension, 0 is placed on top.
    dimCount: number // the total number of dimensions
): HorizonChartLayer | null {
    if (!cellMetaData.selectedLineage) return null;
    const track = node.data;
    let left = getLeftPosition(node);
    let width = getTimeDuration(track);
    if (width === 0) {
        width = cellMetaData.timestep;
        left -= width / 2;
    }

    if (!horizonInViewport(node)) return null;

    const innerHeight = looneageViewStore.rowHeight / dimCount;
    // bottom, left, width, height
    const destination: [number, number, number, number] = [
        node.x - innerHeight * (dimCount - dimIndex - 1),
        left,
        width,
        innerHeight,
    ];

    let dataXExtent = getTimeExtent(track);
    if (dataXExtent[0] === dataXExtent[1]) {
        // special case when there is a single cell in tracks
        dataXExtent = [dataXExtent[0] - width / 2, dataXExtent[0] + width / 2];
    }

    const geometryData = constructGeometry(track, settings.attrKey);
    const horizonChartLayer = new HorizonChartLayer({
        id: `custom-horizon-chart-layer-${track.trackId}-${dimIndex}`,
        data: HORIZON_CHART_MOD_OFFSETS,

        instanceData: geometryData,
        destination,
        dataXExtent,

        baseline: settings.baseline,
        binSize: settings.modHeight,

        getModOffset: (d: any) => d,
        positiveColors: hexListToRgba(settings.positiveColorScheme.value[6]),
        negativeColors: hexListToRgba(settings.negativeColorScheme.value[6]),
        updateTriggers: {
            instanceData: geometryData,
        },
    });

    return horizonChartLayer;
}

watch(selectedLineage, () => {
    looneageViewStore.setDefaultHorizonChartSettingList();
    resetView(); // resetView  calls renderDeckGL
});

function scaleForConstantVisualSize(
    size: number,
    direction: 'x' | 'y'
): number {
    const { zoom } = viewStateMirror.value;
    const z = direction === 'x' ? zoom[0] : zoom[1];
    // scale the size based on the inverse of the zoom so the visual is consistent
    return scaleLengthForConstantVisualSize(size, z);
}

function viewportBBox(includeBuffer = true): BBox {
    const { target } = viewStateMirror.value;
    const buffer = includeBuffer ? viewportBuffer.value : 0;
    const width = scaleForConstantVisualSize(deckGlWidth.value + buffer, 'x');
    const height = scaleForConstantVisualSize(deckGlHeight.value + buffer, 'y');
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const left = target[0] - halfWidth;
    const top = target[1] + halfHeight;
    const right = target[0] + halfWidth;
    const bottom = target[1] - halfHeight;

    return [left, top, right, bottom];
}

function createCurrentTimeLayer(): PathLayer | null {
    if (dataPointSelection.currentTime === null) return null;
    // we place the start time at x=0, so we need to subtract the start time
    const x = dataPointSelection.currentTime - lineageMinTime.value;
    const a = [x, 1000];
    const b = [x, -1000];
    return new PathLayer({
        id: 'current-time-layer',
        data: [[a, b]],
        getPath: (d: any) => d,
        getColor: [130, 130, 130],
        getWidth: 1,
        widthUnits: 'pixels',
    });
}

const currentSnippetCellInfo = ref<SnippetCellInfo[]>();
const cellSegmentationData = ref<Feature[]>();
watch(cellSegmentationData, () => {
    renderDeckGL();
});

interface BoundaryLayerResult {
    mainLayers:
        | (SnippetSegmentationLayer | SnippetSegmentationOutlineLayer)[]
        | null;
    hoveredLayers:
        | (SnippetSegmentationLayer | SnippetSegmentationOutlineLayer)[]
        | null;
}

function createCellBoundaryLayer(
    snippetCellInfo: SnippetCellInfo[]
): BoundaryLayerResult | null {
    if (cellSegmentationData.value == null) return null;

    const data = snippetCellInfo
        .map((info) => {
            const cell = info.cell;
            const trackId = cell.trackId;
            const frame = cellMetaData.getFrame(cell);
            const [x, y] = info.destinationBottomLeft;
            const feature = cellSegmentationData.value?.find(
                (feature) =>
                    // TODO === should work, but JZ data still has id stored as number, when it should be a string
                    feature?.properties?.id == trackId &&
                    feature?.properties?.frame == frame
            );
            const [cellX, cellY] = cellMetaData.getPosition(cell);
            return {
                // @ts-ignore coordinates does exist on geometry
                polygon: feature?.geometry?.coordinates,
                hovered: info.hovered,
                selected: trackId === dataPointSelection.selectedTrackId,
                center: [cellX, cellY],
                offset: [
                    x +
                        (looneageViewStore.snippetDestSize / 2) *
                            2 ** -viewStateMirror.value.zoom[0],
                    y - looneageViewStore.snippetDestSize / 2,
                ],
            };
        })
        .filter((d) => d.polygon !== undefined);

    const mainLayers = [];
    const unselectedColorWithAlpha = colors.unselectedBoundary.rgba;
    unselectedColorWithAlpha[3] = 185;
    const selectedColorWithAlpha = globalSettings.normalizedSelectedRgba;
    selectedColorWithAlpha[3] = 185;

    mainLayers.push(
        new SnippetSegmentationLayer({
            id: 'cell-boundary-layer',
            data: data.filter((d) => !d.hovered),
            getPolygon: (d: any) => d.polygon,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            // getFillColor: [0, 55, 190, 100],
            getFillColor: (d) => {
                if (d.selected) {
                    return selectedColorWithAlpha;
                }
                return unselectedColorWithAlpha;
            },
            // extruded: false,
            // material: false,
            // filled: true,
            // wireframe: false,
            zoomX: viewStateMirror.value.zoom[0],
            scale: looneageViewStore.snippetZoom,
            clipSize: looneageViewStore.snippetDestSize,
            clip: true,
            filled: !looneageViewStore.showSnippetImage, // only fill if not showing image
        })
    );

    mainLayers.push(
        new SnippetSegmentationOutlineLayer({
            id: 'cell-boundary-outline-layer',
            data: data.filter((d) => !d.hovered),
            getPath: (d: any) => d.polygon[0],
            getColor: (d: any) => {
                if (d.selected) {
                    return globalSettings.normalizedSelectedRgb;
                }
                return colors.unselectedBoundary.rgb;
            },
            getWidth: 1.5,
            widthUnits: 'pixels',
            jointRounded: true,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            zoomX: viewStateMirror.value.zoom[0],
            scale: looneageViewStore.snippetZoom,
            clipSize: looneageViewStore.snippetDestSize,
            clip: true,
        })
    );

    const hoveredLayers = [];
    const hoveredWithAlpha = colors.hovered.rgba;
    hoveredWithAlpha[3] = 185;
    hoveredLayers.push(
        new SnippetSegmentationLayer({
            id: 'hovered-cell-boundary-layer',
            data: data.filter((d) => d.hovered),
            getPolygon: (d: any) => d.polygon,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            getFillColor: hoveredWithAlpha,
            zoomX: viewStateMirror.value.zoom[0],
            scale: looneageViewStore.snippetZoom,
            clipSize: looneageViewStore.snippetDestSize,
            clip: hoveredSnippet.value?.extraFrames ? true : false, // only clip if single hover frame is shown
            filled: !looneageViewStore.showSnippetImage, // only fill if not showing image
        })
    );

    hoveredLayers.push(
        new SnippetSegmentationOutlineLayer({
            id: 'hovered-cell-boundary-outline-layer',
            data: data.filter((d) => d.hovered),
            getPath: (d: any) => d.polygon[0],
            getColor: colors.hovered.rgb,
            getWidth: 2,
            widthUnits: 'pixels',
            jointRounded: true,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            zoomX: viewStateMirror.value.zoom[0],
            scale: looneageViewStore.snippetZoom,
            clipSize: looneageViewStore.snippetDestSize,
            clip: hoveredSnippet.value?.extraFrames ? true : false, // only clip if single hover frame is shown
        })
    );

    return { mainLayers, hoveredLayers };
}

function renderDeckGL(): void {
    if (deckgl == null) return;
    if (!cellMetaData.dataInitialized || cellMetaData.selectedLineage == null) {
        renderLoadingDeckGL();
        return;
    }
    const layers = [];

    layers.push(createCurrentTimeLayer());
    layers.push(createConnectingLinesLayer());
    layers.push(createTickMarksLayer());
    layers.push(createHorizonChartLayers());
    if (
        looneageViewStore.showSnippetImage ||
        looneageViewStore.showSnippetOutline
    ) {
        const keyFrameSnippetsResult = createKeyFrameSnippets();
        if (keyFrameSnippetsResult) {
            const {
                snippetCellInfo,
                imageLayer: keyFrameSnippetLayer,
                snippetTickLayer,
                hoverLayer: snippetHoverLayer,
                pickingLayer,
            } = keyFrameSnippetsResult;
            layers.push(snippetTickLayer);
            if (looneageViewStore.showSnippetImage) {
                layers.push(keyFrameSnippetLayer);
            }
            if (!isEqual(currentSnippetCellInfo.value, snippetCellInfo)) {
                currentSnippetCellInfo.value = snippetCellInfo;
                segmentationStore
                    .getCellSegmentations(
                        snippetCellInfo.map((info) => info.cell)
                    )
                    .then((data) => {
                        cellSegmentationData.value = data;
                    });
            }
            const boundaryLayerResult =
                createCellBoundaryLayer(snippetCellInfo);
            if (boundaryLayerResult) {
                if (looneageViewStore.showSnippetOutline) {
                    layers.push(boundaryLayerResult.mainLayers);
                }
                if (looneageViewStore.showSnippetImage) {
                    layers.push(snippetHoverLayer);
                }
                if (looneageViewStore.showSnippetOutline) {
                    layers.push(boundaryLayerResult.hoveredLayers);
                }
            } else if (looneageViewStore.showSnippetImage) {
                layers.push(snippetHoverLayer);
            }
            layers.push(pickingLayer);
        }
    }

    // layers.push(createViewportRectangleLayer());
    deckgl.setProps({
        layers,
        controller: true,
    });
}
watch(darkMode, renderDeckGL);
watch(dataPointSelection.$state, renderDeckGL);
watch(dataPointSelectionUntrracked.$state, renderDeckGL);
watch(imageViewerStore.$state, renderDeckGL);
watch(looneageViewStore.$state, renderDeckGL);
watch(contrastLimitSlider, renderDeckGL);

// Duplicate code from imageViewer.vue
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
</script>

<template>
    <canvas id="looneage-deckgl-canvas" ref="deckGlContainer"></canvas>
</template>

<style scoped lang="scss"></style>
