<script setup lang="ts">
// Vue and core libraries
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useElementSize } from '@vueuse/core';

// Deck.gl and related visualization libraries
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import {
    ScatterplotLayer,
    PolygonLayer,
    LineLayer,
    TextLayer,
} from '@deck.gl/layers';

// Viv libraries for image loading and extensions
import { loadOmeTiff } from '@hms-dbmi/viv';
import { AdditiveColormapExtension } from '@hms-dbmi/viv';
import type { PixelSource } from '@vivjs/types';

// Stores and state management (including Pinia)
import { storeToRefs } from 'pinia';
import {
    type Cell,
    type ExemplarTrack,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { useConfigStore } from '@/stores/misc/configStore';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';

// Utility functions and external libraries
import {
    type BBox,
    getBBoxAroundPoint,
    overlaps1D,
    scaleLengthForConstantVisualSize,
} from '@/util/imageSnippets';
import {
    constructGeometryBase,
    hexListToRgba,
    HORIZON_CHART_MOD_OFFSETS,
} from './deckglUtil';
import { isEqual, cloneDeep, clamp } from 'lodash';
import Pool from '@/util/Pool';
import { LRUCache } from 'lru-cache';
import { format } from 'd3-format';
import colors from '@/util/colors';

// Layers, controllers, and miscellaneous types
import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';
import SnippetSegmentationOutlineLayer from '../layers/SnippetSegmentationOutlineLayer/SnippetSegmentationOutlineLayer';
import CellSnippetsLayer from '../layers/CellSnippetsLayer';
import { type Selection } from '../layers/CellSnippetsLayer';
import type { Feature } from 'geojson';
import { ScrollUpDownController } from './ScrollUpDownController';

// The y-position and visibility of each exemplar track.
interface ExemplarRenderInfo {
    yOffset: number;
    onScreen: boolean;
}
// Combined layers for a cell snippet: cell image, segmentation outline, and tick marks.
interface CellImageLayerResult {
  cellImageLayer: CellSnippetsLayer | null;
  segmentationLayer: SnippetSegmentationOutlineLayer | null;
  tickMarkLayer: LineLayer | null;
}
// Interface for the segmentation data of a cell.
interface LocationSegmentation {
    location: string,
    segmentation: Feature;
}
// Used for ordering and avoiding collisions with other cell images.
interface KeyframeInfo {
    index: number;
    nearestDistance: number;
}
// Text for the histogram
interface HistogramTextData {
    coordinates: [number, number];
    conditionOne: string;
    conditionTwo: string;
}
// Information on a histogram pin.
interface HistogramPin {
    source: number[];
    target: number[];
    exemplar: ExemplarTrack;
    id: string;
    color?: number[];
}

// Store imports -------------------------------------------------

// For cell images
const configStore = useConfigStore();
const segmentationStore = useSegmentationStore();

// For condition selector
const conditionSelectorStore = useConditionSelectorStore();
const { selectedYTag } = storeToRefs(conditionSelectorStore);

// For dataset selection
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentLocationMetadata } = storeToRefs(
    datasetSelectionStore
);

// Data Stores
const looneageViewStore = useLooneageViewStore();
const exemplarViewStore = useExemplarViewStore();
const {
    viewConfiguration,
    exemplarTracks,
    exemplarHeight,
    conditionHistograms,
    histogramDomains,
    exemplarDataLoaded,
    selectedAttribute,
    selectedAggregation,
} = storeToRefs(exemplarViewStore);
const { getHistogramData } = exemplarViewStore;

const cellMetaData = useCellMetaData();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();

// Dark mode settings
const globalSettings = useGlobalSettings();
const { darkMode } = storeToRefs(globalSettings);

// Exemplar data has/hasn't been initialized.
const exemplarDataInitialized = ref(false);

// Reactive reference for totalExperimentTime
const totalExperimentTime = ref(0);

// Deck.gl instance ------------------------------------------------

// Reactive Deck.gl instance
const deckgl = ref<any | null>(null);

const deckGlContainer = ref<HTMLCanvasElement | null>(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

// View state (sizing, scrolling, etc.) -------------------------------------------------------

watch([deckGlHeight, deckGlWidth], () => {
    if (!deckgl.value) return;

    let targetY = clamp(
        viewStateMirror.value.target[1],
        scrollExtent.value.min,
        scrollExtent.value.max
    );
    if (isEqual(viewStateMirror.value, defaultViewState)) {
        targetY =
            (deckGlHeight.value ?? 0) / 2 - viewConfiguration.value.margin;

        // Why random? See https://github.com/visgl/deck.gl/issues/8198
        targetY += +Math.random() * 0.00001;
    }
    // zoomX depends on zoomX so this is a simple iterative solver
    let zoomX = viewStateMirror.value.zoom[0];
    const solverIterations = 10;
    if (deckGlWidth.value != 0) {  
        for (let i = 0; i < solverIterations; i++) {
            zoomX = Math.log2(deckGlWidth.value / visualizationWidth(zoomX));
        }
    }
    const newViewState = {
        zoom: [zoomX, 0],
        target: [visualizationCenterX(zoomX), targetY],
    };
    viewStateMirror.value = cloneDeep(newViewState);
    deckgl.value.setProps({
        initialViewState: newViewState,
    });
    renderDeckGL();
});

function visualizationWidth(scale?: number): number {
    if (scale === undefined) {
        scale = viewStateMirror.value.zoom[0];
    }
    const { histogramWidth, horizonHistogramGap, horizonChartWidth, margin } =
        viewConfiguration.value;
    return (
        scaleLengthForConstantVisualSize(histogramWidth, scale) +
        scaleLengthForConstantVisualSize(horizonHistogramGap, scale) +
        horizonChartWidth +
        2 * scaleLengthForConstantVisualSize(margin, scale)
    );
}

function visualizationCenterX(scale?: number): number {
    if (scale === undefined) {
        scale = viewStateMirror.value.zoom[0];
    }
    const { histogramWidth, horizonHistogramGap, horizonChartWidth } =
        viewConfiguration.value;
    return (
        (horizonChartWidth -
            scaleLengthForConstantVisualSize(histogramWidth, scale) -
            scaleLengthForConstantVisualSize(horizonHistogramGap, scale)) /
        2
    );
}

const defaultViewState = {
    zoom: [0, 0],
    target: [0, 0],
};
const viewStateMirror = ref(defaultViewState);

function scaleForConstantVisualSize(
    size: number,
    direction: 'x' | 'y' = 'x'
): number {
    const { zoom } = viewStateMirror.value;
    const z = direction === 'x' ? zoom[0] : zoom[1];
    // scale the size based on the inverse of the zoom so the visual is consistent
    return scaleLengthForConstantVisualSize(size, z);
}

function viewportBBox(includeBuffer = true): BBox {
    const { target } = viewStateMirror.value;
    const buffer = 200;
    const width = scaleForConstantVisualSize(deckGlWidth.value + buffer);
    const height = deckGlHeight.value + buffer;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const left = target[0] - halfWidth;
    const top = target[1] + halfHeight;
    const right = target[0] + halfWidth;
    const bottom = target[1] - halfHeight;

    return [left, top, right, bottom];
}

const scrollExtent = computed(() => {
    const min =
        deckGlHeight.value / 2 - exemplarViewStore.viewConfiguration.margin;
    const max =
        bottomYOffset.value -
        deckGlHeight.value / 2 +
        exemplarViewStore.viewConfiguration.margin;
    exemplarRenderInfo.value;
    return { min, max };
});

function handleScroll(delta: number) {
    if (!deckgl.value) return;

    // Why random? See https://github.com/visgl/deck.gl/issues/8198
    viewStateMirror.value.target[1] -= delta * 0.5;
    viewStateMirror.value.target[1] = clamp(
        viewStateMirror.value.target[1],
        scrollExtent.value.min,
        scrollExtent.value.max
    );

    const newViewState = cloneDeep(viewStateMirror.value);
    deckgl.value.setProps({
        initialViewState: newViewState,
    });
    renderDeckGL();
}



// Watcher to initialize Deck.gl when experimentDataInitialized becomes true
watch(
    () =>  experimentDataInitialized.value,
    async (initialized) => {
        if (!initialized) {
            // If not initialized, clean up Deck.gl instance
            if (deckgl.value) {
                deckgl.value.finalize();
                deckgl.value = null;
                console.log('Deck.gl instance finalized and removed.');
            }
            totalExperimentTime.value = 0;

            // Reset exemplarDataInitialized
            exemplarDataInitialized.value = false;
            return;
        }
        console.log('Experiment data initialized.');

        // Load exemplar data -----------------------
        // Fetch total experiment time
        totalExperimentTime.value = await exemplarViewStore.getTotalExperimentTime();

        // // Fetch exemplar tracks - that are from exemplarPercentiles of the histogram group
        await exemplarViewStore.getExemplarViewData(true);

        await loadPixelSources();

        // Initialize Deck.gl if not already initialized -----------------
        if (!deckgl.value) {
            console.log("Creating Deck GL");
            deckgl.value = new Deck({
                pickingRadius: 5,
                canvas: deckGlContainer.value,
                views: new OrthographicView({
                    id: 'exemplarController',
                    controller: true,
                }),
                controller: {
                    type: ScrollUpDownController,
                    onScroll: handleScroll,
                },
                layers: [],
                getTooltip: (info: PickingInfo) => {
                    // If the layer is a horizon chart, show the cell index and time.
                    if (
                        info.layer &&
                        info.layer.id &&
                        info.layer.id.startsWith('exemplar-horizon-chart-')
                    ) {
                        // Currently hovered time from store.
                        const time =
                            dataPointSelectionUntrracked.hoveredTime;
                        if (time == null) return null;
                        // Format the time and value (truncate decimals).
                        const formattedTime = customNumberFormatter(
                            time,
                            '.2f'
                        );
                        const formattedValue =
                        hoveredCellsInfo.value && hoveredCellsInfo.value.length > 0
                            ? customNumberFormatter(hoveredCellsInfo.value[0][1].value, '.3f')
                            : '';
                        // Create the tooltip HTML, with the currently hovered exemplar and time.
                        let html = `<h5>Cell: ${hoveredExemplar.value?.trackId}</h5>`;
                        html += `<div>Time: ${formattedTime}</div>`;
                        html += `<div>${selectedAttribute.value}: ${formattedValue}</div>`;
                        return { html };
                    }
                    return null;
                },
                initialViewState: defaultViewState,
                onViewStateChange: ({ viewState, oldViewState }) => {
                    if (oldViewState && !isEqual(viewState, oldViewState)) {
                        // disable pan/zoom from controller, but allow scroll
                        // the controller does have params to disable zoom/scroll
                        // but they weren't working and this does
                        if (!isEqual(viewState.zoom, oldViewState.zoom)) {
                            viewState = { ...oldViewState };
                        } else {
                            viewState.target[0] = oldViewState.target[0];
                        }
                        // TODO: I left this in here for now to demonstrate
                        // difference between scroll/pan performance.
                        // I would like to remove panning though ideally.
                    }

                    viewStateMirror.value = viewState as any;
                    renderDeckGL();
                    return viewState;
                },
            });
            console.log('Deck.gl initialized.');
        }

        // 2. Set exemplarDataInitialized to true after data generation
        exemplarDataInitialized.value = true;
    },
    { immediate: false } // We don't need to run this immediately on mount
);


// Main rendering function for DeckGL -------------------------------------------------------------------
let deckGLLayers: any[] = [];
const cellSegmentationDataInitialized = ref(false);
// Function to render Deck.gl layers
async function renderDeckGL(): Promise<void> {
    if (!deckgl.value) return;

    recalculateExemplarYOffsets();

    // Needs to not loop over every exemplar (only on screen)
    if (!cellSegmentationDataInitialized.value) {
        await getCellSegmentationData();
    }

    deckGLLayers = [];
    deckGLLayers.push(createSidewaysHistogramLayer());
    deckGLLayers.push(createHorizonChartLayer());
    deckGLLayers.push(createTimeWindowLayer());
    deckGLLayers.push(...createExemplarImageKeyFrameLayers());
    deckGLLayers = deckGLLayers.concat(selectedCellImageLayers.value);
    deckGLLayers = deckGLLayers.concat(hoveredOutlineLayer.value);
    deckGLLayers = deckGLLayers.concat(horizonTextLayer.value);
    deckGLLayers = deckGLLayers.concat(snippetSegmentationOutlineLayers.value);

    deckGLLayers = deckGLLayers.filter((layer) => layer !== null);

    deckgl.value.setProps({
        layers: deckGLLayers,
    });
    deckgl.value.redraw();
}

// Clean up Deck.gl on component unmount
onBeforeUnmount(() => {
    if (deckgl.value) {
        deckgl.value.finalize();
        deckgl.value = null;
    }
    // Reset exemplarDataInitialized on unmount
    exemplarDataInitialized.value = false;
});

// Exemplar track choices and positioning ---------------------------------------------------------------

// Map of exemplar tracks to their y-offsets and visibility
const exemplarRenderInfo = ref(new Map<string, ExemplarRenderInfo>());

// Finds the exemplar tracks that are currently on screen.
const exemplarTracksOnScreen = computed(() => {
    return exemplarTracks.value.filter((exemplar: ExemplarTrack) => {
        const renderInfo = exemplarRenderInfo.value.get(
            uniqueExemplarKey(exemplar)
        );
        return renderInfo ? renderInfo.onScreen : false;
    }) as ExemplarTrack[];
});

function groupExemplarsByCondition(
    exemplars: ExemplarTrack[]
): ExemplarTrack[][] {
    const groups: ExemplarTrack[][] = [];
    let currentGroup: ExemplarTrack[] = [];

    for (const exemplar of exemplars) {
        if (currentGroup.length === 0) {
            currentGroup.push(exemplar);
        } else {
            const lastExemplar = currentGroup[currentGroup.length - 1];
            if (isEqual(exemplar.tags, lastExemplar.tags)) {
                currentGroup.push(exemplar);
            } else {
                groups.push(currentGroup);
                currentGroup = [exemplar];
            }
        }
    }
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}

const bottomYOffset = computed(() => {
    return Math.max(
        ...Array.from(exemplarRenderInfo.value.values()).map(
            (renderInfo: ExemplarRenderInfo) => renderInfo.yOffset
        )
    );
});

// Finds the exemplar tracks Y-values on screen.
function recalculateExemplarYOffsets(): void {
    exemplarRenderInfo.value.clear();
    let yOffset = 0;
    let lastExemplar = exemplarTracks.value[0];
    for (let i = 0; i < exemplarTracks.value.length; i++) {
        const exemplar = exemplarTracks.value[i];
        yOffset += exemplarHeight.value;
        if (i !== 0) {
            if (isEqual(exemplar.tags, lastExemplar.tags)) {
                yOffset += viewConfiguration.value.betweenExemplarGap;
            } else {
                yOffset += viewConfiguration.value.betweenConditionGap;
            }
        }
        const key = uniqueExemplarKey(exemplar);
        // TODO: calc onscreen
        const viewBBox = viewportBBox();
        const lastYOffset =
            exemplarRenderInfo.value.get(uniqueExemplarKey(lastExemplar))
                ?.yOffset ?? yOffset;
        const onScreen = overlaps1D(
            lastYOffset,
            yOffset,
            viewBBox[3],
            viewBBox[1]
        );
        exemplarRenderInfo.value.set(key, { yOffset, onScreen });
        lastExemplar = exemplar;
    }
}

// Loading Image Data -----------------------------------------------------------------------------------

const pixelSources = ref<{ [key: string]: PixelSource<any> } | null>(null);
const loader = ref<any | null>(null);

const loadingPool = new Pool();
// Load the pixel source from the current location metadata.
async function loadPixelSource(locationId: string, url: string) {
    // If already loaded, return the existing source.
    if (pixelSources.value && pixelSources.value[locationId]) {
        return;
    }
    const fullImageUrl = configStore.getFileUrl(url);

    loader.value = await loadOmeTiff(fullImageUrl, {
        pool: loadingPool,
    });

    // If pixelSources.value is null, first initialize it as an empty object.
    if (!pixelSources.value) {
        pixelSources.value = {};
    }

    // Reassign pixelSources.value with the new key as the first property.
    pixelSources.value[locationId] = loader.value.data[0];
}

// Load all pixel sources for each exemplar track.
async function loadPixelSources() {
    const exemplarUrls = exemplarViewStore.getExemplarImageUrls();
    const locationIds = Array.from(exemplarUrls.keys());
    const concurrencyLimit = 100; // adjust this number as needed
    let index = 0;

    async function loadNextPixelSource() {
        if (index >= locationIds.length) return;
        const locationId = locationIds[index++];
        const url = exemplarUrls.get(locationId);
        if (url) {
            await loadPixelSource(locationId, url);
        } else {
            console.error(`URL not found for locationId: ${locationId}`);
        }
        await loadNextPixelSource();
    }

    const pool: Promise<void>[] = [];
    for (let i = 0; i < concurrencyLimit; i++) {
        pool.push(loadNextPixelSource());
    }
    await Promise.all(pool);
}

// Getting Segmentation Data ------------------------------------------------------------------------------------
let cellSegmentationData = ref<LocationSegmentation[]>([]);
async function getCellSegmentationData() {
    // For every cell from every exemplar track, get its segmentation and location and push that to the cellSegmentationData
    for (const exemplar of exemplarTracks.value) {
        if (!exemplar.data || exemplar.data.length === 0) continue;
        // For every exemplar track, iterate through its cells to get segmentation and location
        for (const cell of exemplar.data) {
            const segmentation = await segmentationStore.getCellLocationSegmentation(
                cell.frame.toString(),
                exemplar.trackId,
                exemplar.locationId
            );
            if (segmentation) {
                cellSegmentationData.value.push({
                    location: exemplar.locationId,
                    segmentation: segmentation,
                });
            }
        }
    }
    cellSegmentationDataInitialized.value = true;
}

// Gets the segmentation polygon for a specific cell
function getCellSegmentationPolygon(location: string, trackId: string, frame: string): Feature | undefined {
    const cellSegmentation = cellSegmentationData.value?.find(
        (locationSegmentation) =>
            locationSegmentation?.location == location &&
            locationSegmentation?.segmentation?.properties?.id == trackId &&
            locationSegmentation?.segmentation?.properties?.frame == frame
    );

    return cellSegmentation ? cellSegmentation.segmentation : undefined;
}

// Horizon Chart Layer ------------------------------------------------------------------------------------------
const horizonChartScheme = [
    '#e6e3e3', // Light Grey 1
    '#cccccc', // Light Grey 2
    '#b3b3b3', // Grey 3
    '#999999', // Grey 4
    '#808080', // Grey 5
    '#666666', // Grey 6
    '#4d4d4d', // Grey 7
    '#1a1a1a', // Grey 9
    '#000000', // Black
];

function createHorizonChartLayer(): HorizonChartLayer[] | null {
    const horizonChartLayers: HorizonChartLayer[] = [];

    // Get the global min and max values for every exemplar, for color scaling.
    const tracks = exemplarViewStore.exemplarTracks;
    const exemplarTracksMin =
        tracks.length > 0 ? Math.min(...tracks.map((t) => t.minValue)) : 0;
    const exemplarTracksMax =
        tracks.length > 0 ? Math.max(...tracks.map((t) => t.maxValue)) : 0;

    for (const exemplar of exemplarTracksOnScreen.value) {
        if (!exemplar.data || exemplar.data.length === 0) {
            continue; // Skip this exemplar if there's no data
        }

        const renderInfo = exemplarRenderInfo.value.get(
            uniqueExemplarKey(exemplar)
        );
        if (!renderInfo) {
            throw new Error('renderInfo is undefined');
        }
        // if (!renderInfo.onScreen) continue;

        const yOffset =
            renderInfo.yOffset -
            viewConfiguration.value.timeBarHeightOuter
            viewConfiguration.value.horizonTimeBarGap;

        // TODO: probably skip if not in viewport

        const geometryData = constructGeometry(exemplar);

        horizonChartLayers.push(
            new HorizonChartLayer({
                id: `exemplar-horizon-chart-${uniqueExemplarKey(exemplar)}`,
                data: HORIZON_CHART_MOD_OFFSETS,
                pickable: true,
                onHover: (info: PickingInfo, event: any) => {
                    handleHorizonHover(info, exemplar);
                },
                onClick: (info: PickingInfo, event: any) => {
                    handleHorizonClick(info, exemplar)
                },
                instanceData: geometryData,
                destination: [
                    yOffset,
                    0,
                    viewConfiguration.value.horizonChartWidth,
                    viewConfiguration.value.horizonChartHeight,
                ], // [bottom, left, width, height]
                dataXExtent: [exemplar.minTime, exemplar.maxTime],

                baseline: exemplarTracksMin,
                binSize:
                    (exemplarTracksMax - exemplarTracksMin) /
                    (horizonChartScheme.length - 1),

                getModOffset: (d: any) => d,
                positiveColors: hexListToRgba(horizonChartScheme),
                negativeColors: hexListToRgba(horizonChartScheme),
                updateTriggers: {
                    instanceData: geometryData,
                },
            })
        );
    }
    return horizonChartLayers;
}

// Create a reactive reference for the hovered outline layer.
const hoveredOutlineLayer = ref<PolygonLayer | null>(null);
const horizonTextLayer = ref<TextLayer | null>(null);

function createHoveredHorizonOutlineLayer() {
  // Find the exemplar corresponding to the hovered value
  if (!hoveredExemplar.value) {
    hoveredOutlineLayer.value = null;
    return;
  }
  const exemplar = hoveredExemplar.value;
  const renderInfo = exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar));
  if (!renderInfo) return;
  const yOffset =
    renderInfo.yOffset -
    viewConfiguration.value.timeBarHeightOuter;

    hoveredOutlineLayer.value = new PolygonLayer({
    id: `exemplar-hovered-outline-${uniqueExemplarKey(exemplar)}`,
    data: [
      {
        polygon: [
          [0, yOffset],
          [viewConfiguration.value.horizonChartWidth, yOffset],
          [
            viewConfiguration.value.horizonChartWidth,
            yOffset - viewConfiguration.value.horizonChartHeight,
          ],
          [0, yOffset - viewConfiguration.value.horizonChartHeight],
          [0, yOffset],
        ],
      },
    ],
    pickable: false,
    stroked: true,
    filled: false,
    getPolygon: (d: any) => d.polygon,
    getLineColor: (d: any) => colors.hovered.rgb,
    getLineWidth: () => 4,
    lineWidthUnits: "pixels",
    updateTriggers: {
      hoveredExemplar: hoveredExemplar.value,
    },
});

  const label = `${selectedAttribute.value}`;
  const labelData = [
    {
      position: [
        0, yOffset
      ],
      label: label,
    },
  ];
   horizonTextLayer.value = new TextLayer({
        id: `horizon-chart-label-layer-${uniqueExemplarKey(exemplar)}`,
        data: labelData,
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.label,
        getSize: 12,
        getAngle: 0,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'bottom',
        getColor: [0, 0, 0, 255],
        backgroundPadding: [5, 2],
        background: true,
        backgroundColor: [255, 255, 255, 160],
    });
}

// Event handlers for horizon chart interactions
function handleHorizonHover(info: PickingInfo, exemplar: ExemplarTrack) {

    // Set hoveredExemplar based on the info index
    if (info.index === undefined || info.index === -1) {
        hoveredExemplar.value = null;
        hoveredCellsInfo.value = [];
        hoveredOutlineLayer.value = null;
        renderDeckGL();
        return;
    }
    hoveredExemplar.value = exemplar;
    createHoveredHorizonOutlineLayer();

    // Cell image + segmentation appears on mouse hover
    const cellImageEventsLayer = createCellImageEventsLayer(info, exemplar, 'hover');

    deckgl.value?.setProps({
  layers: [
    ...deckGLLayers,
    cellImageEventsLayer?.tickMarkLayer,  // Render tick layer behind
    cellImageEventsLayer?.cellImageLayer,
    cellImageEventsLayer?.segmentationLayer
  ]
});
}

function handleHorizonClick(info: PickingInfo, exemplar: ExemplarTrack) {
    if (!info.index || info.index === -1) {
        return;
    }
    createCellImageEventsLayer(info, exemplar, 'click');
}

// Time Window Layer -------------------------------------------------------------------------------------------
function createTimeWindowLayer(): PolygonLayer[] | null {
    // TODO: implement
    const placeholderLayer: PolygonLayer[] = [];

    // Total Experiment Time - 1/4 of the time bar height
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-background-placeholder-${selectedAttribute.value}`,
            data: [...exemplarTracksOnScreen.value],
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset =
                    exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar))
                        ?.yOffset ?? 0;
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
            getFillColor: [0, 0, 0, 255],
            getLineWidth: 0,
            opacity: 0.05,
            lineWidthUnits: 'pixels',
            updateTriggers: {
                getPolygon: {
                    selectedAttribute: selectedAttribute.value,
                },
                getFillColor: {
                    selectedAttribute: selectedAttribute.value,
                },
            },
        })
    );

    // Exemplar time window - Black bar on top of the total experiment time
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-time-window-${selectedAttribute.value}`,
            data: [...exemplarTracksOnScreen.value],
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset =
                    exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar))
                        ?.yOffset ?? 0;
                const cellBirthTime = exemplar.minTime;
                const cellDeathTime = exemplar.maxTime;
                const timeBarWidth = viewConfiguration.value.horizonChartWidth;
                const cellBirthXValue =
                    (cellBirthTime / totalExperimentTime.value) * timeBarWidth;
                let cellDeathXValue =
                    (cellDeathTime / totalExperimentTime.value) * timeBarWidth;

                // If cellBirthTime and cellDeathTime are the same, adjust cellDeathXValue
                if (cellBirthTime === cellDeathTime) {
                    cellDeathXValue += (1 / 500) * timeBarWidth;
                }

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

            getFillColor: fillColor,
            updateTriggers: {
                getPolygon: {
                    selectedAttribute: selectedAttribute.value,
                },
                getFillColor: {
                    selectedAttribute: selectedAttribute.value,
                },
            },
            getLineWidth: 0,
            lineWidthUnits: 'pixels',
        })
    );

    return placeholderLayer;
}

// Sideways histogram layer ----------------------------------------------------------------------------------------
function createSidewaysHistogramLayer(): any[] | null {
    const layers: any[] = [];

    // Group exemplars by condition (conditionOne + conditionTwo)
    const groupedExemplars = groupExemplarsByCondition(
        exemplarTracksOnScreen.value
    );

    let { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
    hGap = scaleForConstantVisualSize(hGap);
    histWidth = scaleForConstantVisualSize(histWidth);
    const domains = histogramDomains.value; // { histogramBinRanges, minX, maxX, minY, maxY }

    for (const group of groupedExemplars) {
        if (group.length === 0) continue;

        const firstExemplar = group[0];
        const conditionOne = firstExemplar.tags.conditionOne;
        const conditionTwo = firstExemplar.tags.conditionTwo;

        // Find histogram data for this group
        const histogramDataForGroup =
            conditionHistograms.value.find(
                (ch) =>
                    ch.condition.conditionOne === conditionOne &&
                    ch.condition.conditionTwo === conditionTwo
            )?.histogramData || [];

        // Basic geometry for the condition grouping
        const firstOffset =
            exemplarRenderInfo.value.get(uniqueExemplarKey(firstExemplar))
                ?.yOffset ?? 0;
        const lastOffset =
            exemplarRenderInfo.value.get(
                uniqueExemplarKey(group[group.length - 1])
            )?.yOffset ?? 0;
        const groupTop = firstOffset - exemplarHeight.value;
        const groupBottom = lastOffset;
        const groupHeight = groupBottom - groupTop;
        const binWidth = groupHeight / histogramDataForGroup.length;

        // ADD HORIZONTAL "TICK" LINES AND VERTICAL CONNECTOR LINES FOR EACH EXEMPLAR
        //
        // 1. Compute average mass.
        // 2. Find which bin it falls into.
        // 3. Compute y-mid of that bin & x-range of that bin's polygon.
        // 4. Store line data for LineLayer.
        // 5. Add a vertical line connecting to the horizon chart.
        //
        const pinData: {
            source: [number, number];
            target: [number, number];
            exemplar: ExemplarTrack;
        }[] = [];
        const pinToHorizonChartData: {
            source: [number, number];
            target: [number, number];
            exemplar: ExemplarTrack;
        }[] = [];
        const circlePositions: {
            position: [number, number];
            exemplar: ExemplarTrack;
        }[] = [];

        for (const exemplar of group) {
            const yOffset =
                exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar))
                    ?.yOffset ??
                0 -
                    viewConfiguration.value.timeBarHeightOuter -
                    viewConfiguration.value.horizonTimeBarGap;
            const avgAttr = getAverageAttr(exemplar);

            // Find bin index by checking the histogramDomains bin ranges
            const binIndex = domains.histogramBinRanges.findIndex(
                (bin) => avgAttr >= bin.min && avgAttr < bin.max
            );
            if (binIndex < 0) {
                // If out of range, skip
                continue;
            }

            // Compute y-mid of the bin
            const y0 = groupTop + binIndex * binWidth;
            const y1 = y0 + binWidth;
            const yMid = (y0 + y1) / 2;

            // Fixed horizontal length: histWidth * 0.75
            const fixedLineLength = histWidth * 0.75;
            const x0 = hGap + 0.25 * histWidth;
            const x1 = x0 + fixedLineLength;

            // Draw horizontal line from -x0 to -(x0 + fixedLineLength) at yMid
            pinData.push({
                source: [-x0, yMid],
                target: [-(x0 + fixedLineLength), yMid],
                exemplar,
            });

            
            // Draw vertical connector line from end of horizontal line to horizon chart
            pinToHorizonChartData.push({
                source: [-x0, yMid],
                target: [0, yOffset - viewConfiguration.value.horizonTimeBarGap],
                exemplar,
            });

            // Collect circle position at the left end (-x0, yMid)
            circlePositions.push({
                position: [-x1, yMid],
                exemplar,
            });
        }

        // Start of Selection
        // Draw the base thick line
        layers.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-base-line-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: [group],
                getSourcePosition: () => [-hGap - histWidth * 0.2, groupBottom],
                getTargetPosition: () => [-hGap - histWidth * 0.2, groupTop],
                getColor: fillColor(firstExemplar),
                // Start of Selection
                lineWidthUnits: 'common',
                lineWidth: 7, // Adjust thickness as needed
            })
        );

        // Draw the "filled" sideways histogram bins
        const histogramValues = histogramDataForGroup.map((count, index) => {
            // Compute polygon coordinates for each bin
            const y0 = groupTop + index * binWidth;
            const y1 = y0 + binWidth;
            const x0 = hGap + 0.25 * histWidth;
            const x1 = x0 + (count / domains.maxY) * (histWidth * 0.75);
            // Get the corresponding bin range from the histogramDomains
            const binRange = domains.histogramBinRanges[index];

            return {
                polygon: [
                    [-x0, y0],
                    [-x1, y0],
                    [-x1, y1],
                    [-x0, y1],
                    [-x0, y0],
                ],
                binIndex: index,
                count: count,
                y0: y0,
                y1: y1,
                // Include the min/max attribute for this bin range
                minAttr: binRange?.min,
                maxAttr: binRange?.max,
            };
        });

        // Draw the histogram bins
        layers.push(
            new PolygonLayer({
                id: `sideways-histogram-layer-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: histogramValues,
                pickable: false,
                stroked: false,
                filled: true,
                extruded: false,
                getPolygon: (d: any) => d.polygon,
                getFillColor: [153, 153, 153],
                getElevation: 0,
            })
        );

        // The histogram hover box, whose 'onHover' event triggers the histogram hover logic (moving pins)
        layers.push(
            new PolygonLayer({
                id: `sideways-histogram-hover-layer-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                pickable: true,
                data: [group],
                getPolygon: () => {
                    return [
                        [-hGap - histWidth, groupBottom],
                        [-hGap - histWidth * 0.2, groupBottom],
                        [-hGap - histWidth * 0.2, groupTop],
                        [-hGap - histWidth, groupTop],
                        [-hGap - histWidth, groupBottom],
                    ];
                },
                getFillColor: [0, 0, 0, 0],
                getLineWidth: 0,
                onHover: (info: PickingInfo, event: any) =>
                    handleHistogramHover(
                        info,
                        event,
                        firstExemplar,
                        histogramValues
                    ),
                onClick: (info: PickingInfo, event: any) =>
                    handleHistogramClick(
                        info,
                        event,
                        firstExemplar,
                        histogramValues,
                        groupBottom,
                        groupTop
                    ),
            })
        );


        // Create the histogram pin layers
        layers.push(...createPinLayers(pinData, firstExemplar));

        // Push a new LineLayer to draw these lines with thinner stroke
        layers.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-lines-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: pinToHorizonChartData,
                pickable: false,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: (d: { exemplar: ExemplarTrack }) =>
                hoveredExemplar.value && hoveredExemplar.value.trackId === d.exemplar.trackId
                    ? colors.hovered.rgb
                    : fillColor(d.exemplar),
                getWidth: (d: {
                    source: [number, number];
                    target: [number, number];
                    exemplar: ExemplarTrack;
                }) =>
                    hoveredExemplar.value === d.exemplar
                        ? 4
                        : 1, // Thinner stroke width
                opacity: 1,
            })
        );

        // Text Layer
        const yOffset = (groupBottom + groupTop) / 2;

        const textData: HistogramTextData[] = [
            {
                coordinates: [-hGap - 0.1 * histWidth, yOffset],
                conditionOne,
                conditionTwo,
            },
        ];

        layers.push(
            new TextLayer({
                id: `exemplar-sideways-histogram-text-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: textData,
                getPosition: (d: HistogramTextData) => d.coordinates,
                getText: (d: HistogramTextData) => `${d.conditionOne} ${d.conditionTwo}`,
                sizeScale: 1,
                sizeUnits: 'pixels',
                sizeMaxPixels: 25,
                getAngle: 90,
                getColor: fillColor(firstExemplar),
                billboard: true,
                textAnchor: 'middle',
                alignmentBaseline: 'middle',
            })
        );
    }

    return layers;
}

// Histogram Pins ------------------------------------------------------
const tempPin = ref<HistogramPin | null>(null);
const tempLabel = ref<{ text: string; position: [number, number] } | null>(null);
const pinnedPins = ref<HistogramPin[]>([]);
const dragPin = ref<HistogramPin | null>(null);

// Handle hovering on the histogram hover box. This function now updates the temporary pin (or clears it if the pointer
// has left the hovered area) and then calls updatePinsLayer() to re-render all pins.
function handleHistogramHover(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack,
    histogramData: any[]
) {
    // When the pointer leaves the polygon (info.index === -1) or no coordinate,
    // clear the temporary pin.
    if (!info.coordinate || info.index === -1) {
        tempPin.value = null;
        tempLabel.value = null;
        updatePinsLayer(firstExemplar);
        return;
    }
    // Otherwise, compute the pin position based on the mouse coordinate.
    const hoveredY = info.coordinate[1];
    let { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
    hGap = scaleForConstantVisualSize(hGap);
    histWidth = scaleForConstantVisualSize(histWidth);
    const fixedLineLength = histWidth * 0.75;
    const x0 = hGap + 0.25 * histWidth;

    // Set the temporary pin: positioned at the hoveredY
    tempPin.value = {
        source: [-x0, hoveredY],
        target: [-(x0 + fixedLineLength), hoveredY],
        exemplar: firstExemplar,
        id: 'temp', // a temporary identifier
    };

    // Find the bin index & count of the hoveredY, using the histogramValues
    const binIndex = histogramData.findIndex(
        (d) => d.y0 <= hoveredY && d.y1 >= hoveredY
    );

    if (binIndex === -1) {
        tempLabel.value = null;
        updatePinsLayer(firstExemplar);
        return;
    }

    // Get the bin's count and the min/max attribute values
    const bin = histogramData[binIndex];
    const count = bin.count;

    const [minStr, maxStr] = [bin.minAttr, bin.maxAttr].map((x) =>
        (Math.trunc(x * 1000) / 1000).toFixed(2)
    );

    // Set the temporary label: positioned 10 pixels left of the pin circle.
    tempLabel.value = {
        text: `Count: ${count}\n[${minStr}, ${maxStr}]`,
        position: [-(x0 + fixedLineLength), hoveredY + 10],
    };

    updatePinsLayer(firstExemplar);
}

// When the histogram hover box is clicked, pin the current temporary pin
// The current temporary pin is added to the pinnedPins array and temporary pin is cleared
async function handleHistogramClick(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack,
    histogramData: any[],
    histogramBottomY: number,
    histogramTopY: number
) {
    if (!info.coordinate) return;
    if (tempPin.value) {
        const newPin = {
            ...tempPin.value,
            id: `pinned-${Date.now()}`,
            color: fillColor(tempPin.value.exemplar),
        };
        pinnedPins.value.push(newPin);
        // Clear temporary pin so that hovering will create a new one.
        tempPin.value = null;
        updatePinsLayer(firstExemplar);

        // Add the new pin to the exemplarTracks array

        const hoveredY = info.coordinate[1];
        // Find the bin index & count of the hoveredY, using the histogramValues
        const binIndex = histogramData.findIndex(
            (d) => d.y0 <= hoveredY && d.y1 >= hoveredY
        );

        if (binIndex === -1) {
            tempLabel.value = null;
            updatePinsLayer(firstExemplar);
            return;
        }
        // Get p-value from histogram,
        // Get the bin's count and the min/max attribute values
        const bin = histogramData[binIndex];
        await exemplarViewStore.getExemplarTracks(
            false,
            undefined,
            bin.minAttr
        );

        await loadPixelSources();

        // First ensure that the new exemplar tracks are loaded, then render.
        renderDeckGL();
    }
}

// Helper function to update the pins layer.
// Combines any pinned pins with the temporary pin (if it exists) and updates
// deck.gl's layers to include both the base layers and the pin layers.
function updatePinsLayer(firstExemplar: ExemplarTrack) {
    const allPins = [...pinnedPins.value];
    if (tempPin.value) {
        allPins.push(tempPin.value);
    }

    const pinLayers = createPinLayers(allPins, firstExemplar);

    // If a tempLabel exists, add a TextLayer.
    if (tempLabel.value) {
        pinLayers.push(
            new TextLayer({
                id: `exemplar-temp-label-${uniqueExemplarKey(firstExemplar)}`,
                data: [tempLabel.value],
                getPosition: (d: {
                    text: string;
                    position: [number, number];
                }) => d.position,
                getText: (d: { text: string }) => d.text,
                sizeScale: 1,
                sizeUnits: 'common',
                sizeMaxPixels: 20,
                // Set color as desired (here black) using an accessor function:
                getColor: (d: any) => [0, 0, 0],
                // Use the proper TextLayer props:
                getTextAnchor: (d: any) => 'start', // 'end' aligns text to the right
                getAlignmentBaseline: (d: any) => 'top', // 'center' is the correct baseline value
                billboard: true,
            })
        );
    }

    deckgl.value.setProps({
        layers: [...deckGLLayers, ...pinLayers],
        controller: true,
    });
}

function createPinLayers(pins: any[], firstExemplar: ExemplarTrack) {
    const pinLayers = [];
    pinLayers.push(
        new LineLayer({
            id: `exemplar-pin-lines-${uniqueExemplarKey(firstExemplar)}`,
            data: pins,
            pickable: false,
            getSourcePosition: (d: any) => d.source,
            getTargetPosition: (d: any) => d.target,
            getColor: (d: HistogramPin) =>
                hoveredExemplar.value === d.exemplar
                ? colors.hovered.rgb
                : d.color
                ? d.color
                : fillColor(d.exemplar),
            // Adjust the line width based on hover state.
            getWidth: (d: any) =>
                hoveredExemplar.value === d.exemplar
                    ? 4
                    : 1,
            opacity: 0.2,
        })
    );
    const circleData = pins.map((d) => ({
        position: d.target,
        exemplar: d.exemplar,
        id: d.id,
    }));
    pinLayers.push(
        new ScatterplotLayer({
            id: `exemplar-pin-circles-${uniqueExemplarKey(firstExemplar)}`,
            data: circleData,
            pickable: true, // enable interaction with the pin circles
            getPosition: (d: any) => d.position,
            radiusUnits: 'pixels',
            getRadius: (d: any) =>
                hoveredExemplar.value === d.exemplar
                    ? 6
                    : 3,
            getColor: (d: HistogramPin) =>
                hoveredExemplar.value === d.exemplar
                ? colors.hovered.rgb
                : d.color
                ? d.color
                : fillColor(d.exemplar),
            getFillColor: (d: HistogramPin) =>
                hoveredExemplar.value === d.exemplar
                ? colors.hovered.rgb
                : d.color
                ? d.color
                : fillColor(d.exemplar),
            // When a pin is clicked, dragged or released, we log a dummy event.
            onDragStart: (info: PickingInfo, event: any) =>
                handlePinDragStart(info, event, firstExemplar),
            onDrag: (info: PickingInfo, event: any) =>
                handlePinDrag(info, event, firstExemplar),
            onDragEnd: (info: PickingInfo, event: any) =>
                handlePinDragEnd(info, event, firstExemplar),
        })
    );
    return pinLayers;
}

function handlePinDragStart(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack
) {
    dragPin.value = info.object;
}

function handlePinDrag(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack
) {
    if (!info.coordinate) return;
    const hoveredY = info.coordinate[1];
    const { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
    const fixedLineLength = histWidth * 0.75;
    const x0 = hGap + 0.25 * histWidth;
    const index = pinnedPins.value.findIndex((p) => p.id === info.object.id);
    if (index >= 0) {
        pinnedPins.value[index] = {
            ...pinnedPins.value[index],
            source: [-x0, hoveredY],
            target: [-(x0 + fixedLineLength), hoveredY],
        };
        updatePinsLayer(firstExemplar);
    }
}

function handlePinDragEnd(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack
) {
    dragPin.value = null;
    updatePinsLayer(firstExemplar);
}

// Cell Image Layers -----------------------------------------------------------------------------------------------------

/**
 * Computes the correct time point from the exemplar data given an estimated time.
 * Returns the minTime if the estimated time is too low or maxTime if too high.
 * Otherwise it finds the closest actual time from the exemplar data.
 */
 function computeRealTimePoint(exemplar: ExemplarTrack, estimatedTime: number): number {
  if (estimatedTime < exemplar.minTime) {
    return exemplar.minTime;
  }
  if (estimatedTime > exemplar.maxTime) {
    return exemplar.maxTime;
  }
  // Use reduce to find the closest time value
  return exemplar.data.reduce((prev, curr) =>
    estimatedTime > curr.time &&
    Math.abs(curr.time - estimatedTime) < Math.abs(prev.time - estimatedTime)
      ? curr
      : prev,
    exemplar.data[0]
  ).time;
}

// The currently selected exemplar, its currently selected value, and selected image layers.
const selectedExemplar = ref<ExemplarTrack | null>(null);
const selectedCellsInfo = ref<[BBox, Cell][]>([]);const selectedCellImageLayers = ref<CellSnippetsLayer[]>([]);
// The currently hovered exemplar, its currently hovered value, and hovered image layers.
const hoveredExemplar = ref<ExemplarTrack | null>(null);
const hoveredCellsInfo = ref<[BBox, Cell][]>([]);
const hoveredImagesInfo = ref<[BBox, Cell][]>([]);


/**
 * Handles cell image events for both click and hover actions.
 * It calculates the corresponding time point from the click/hover coordinate,
 * retrieves the relevant cell, and creates the appropriate image layer.
 */
function createCellImageEventsLayer(
  info: PickingInfo,
  exemplar: ExemplarTrack,
  action: 'click' | 'hover'
) {
  // Validate the input coordinate
  if (info.index === -1 || !info.coordinate) {
    console.error('[handleHorizonCellImages] info.index or info.coordinate invalid');
    dataPointSelectionUntrracked.hoveredTrackId = null;
    return;
  }

  const X = info.coordinate[0];
  if (X == null) {
    dataPointSelectionUntrracked.hoveredTrackId = null;
    console.error('[handleHorizonCellImages] X is undefined');
    return;
  }

  // Calculate estimated time based on the X coordinate and chart width
  const { horizonChartWidth } = viewConfiguration.value;
  const estimatedTime = Math.max(
    0,
    exemplar.minTime +
      (exemplar.maxTime - exemplar.minTime) * (X / horizonChartWidth)
  );

  // Compute the real time point from the exemplar data
  const realTimePoint = computeRealTimePoint(exemplar, estimatedTime);

  // Update the hovered track ID in the dataPointSelectionUntrracked store
  dataPointSelectionUntrracked.hoveredTrackId = exemplar.trackId;

  // Update the hovered time in the dataPointSelectionUntrracked store
  dataPointSelectionUntrracked.hoveredTime = realTimePoint;

  // Find the cell corresponding to the computed time point
  const cell = exemplar.data.find((d) => d.time === realTimePoint);
  if (!cell || !cell.value) {
    console.error('[handleHorizonCellImages] cell or cell.value is undefined');
    return;
  }

  // Retrieve the pixel source for the exemplar's location
  const locationId = exemplar.locationId;
  const pixelSource = pixelSources.value?.[locationId];
  if (!pixelSource) {
    console.error('[handleHorizonCellImages] Pixel source not found for locationId:', locationId);
    return;
  }

  // Create an image events layer for the cell
  const cellImageLayerResult = createCellImageLayer(pixelSource, exemplar, cell);
  if (!cellImageLayerResult) {
    console.error('[handleHorizonCellImages] selectedLayer is null');
    return;
  }

  const eventCellBBox = cellImageLayerResult.cellImageLayer?.snippetBBox;
  // Update state based on the action type (click or hover)
  if (action === 'hover') {
    // The currently hovered bounding box for the cell image layer.
    
    hoveredCellsInfo.value = [[eventCellBBox,cell]];

    // Handle collisions with existing cell images and the hovered cell image --------------

    renderDeckGL();
  }
  else if (action === 'click') {
    selectedExemplar.value = exemplar;
    selectedCellsInfo.value?.push([eventCellBBox, cell]);
    if (cellImageLayerResult.cellImageLayer) { selectedCellImageLayers.value.push(cellImageLayerResult.cellImageLayer); }
    if (cellImageLayerResult.segmentationLayer) { snippetSegmentationOutlineLayers.value.push(cellImageLayerResult.segmentationLayer);
    renderDeckGL(); // Trigger a re-render after updating the layers
    }
  } 
  return cellImageLayerResult;
}

function rectsOverlap(bbox1: [number, number, number, number], bbox2: [number, number, number, number]): boolean {
  // They do not overlap if one is left of or above the other
  return !(
    bbox1[2] <= bbox2[0] || // bbox1 right is left of bbox2 left
    bbox1[0] >= bbox2[2] || // bbox1 left is right of bbox2 right
    bbox1[3] >= bbox2[1] || // bbox1 bottom is above bbox2 top
    bbox1[1] <= bbox2[3]    // bbox1 top is below bbox2 bottom
  );
}
/**
 * Createel a cell image layer for click/hover events.
 * This function computes the destination coordinates for the snippet
 * based on the cell's time position and returns a new CellSnippetsLayer.
 */
function createCellImageLayer(
  pixelSource: PixelSource<any>,
  exemplar: ExemplarTrack,
  cell: Cell
): CellImageLayerResult  | null {
  // Initialize an array to hold snippet selection(s).
  const selections: Selection[] = [];
  const viewConfig = viewConfiguration.value;
  
  // Calculate snippet destination dimensions.
  const snippetDestWidth = scaleForConstantVisualSize(viewConfig.snippetDisplayWidth);
  const snippetDestHeight = viewConfig.snippetDisplayHeight;
  
  // Compute the destination Y coordinate.
  // Start with a fallback equal to the base horizon chart height.
  let destY = viewConfig.horizonChartHeight;
  if (exemplarTracks.value && exemplarTracks.value.length > 0) {
    const key = uniqueExemplarKey(exemplar);
    // Get the yOffset for the current exemplar from the render info map.
    const yOffset = exemplarRenderInfo.value.get(key)?.yOffset ?? 0;
    if (yOffset !== undefined && yOffset !== null) {
      // Adjust destY to position the snippet above the main horizon chart.
      destY =
        yOffset -
        viewConfig.timeBarHeightOuter -
        viewConfig.snippetHorizonChartGap -
        viewConfig.horizonChartHeight -
        viewConfig.snippetHorizonChartGap;
    } else {
      console.error('[createCellImageEventsLayer] No yOffset found for key:', key);
    }
  }
  
  // Validate that exemplar and its cell value are present.
  if (!exemplar || !cell.value) {
    console.error('[createCellImageEventsLayer] Exemplar or cell is null');
    return null;
  }
  
  // Determine the horizontal (x) position based on the cell time relative to the exemplar time range.
  const percentage = (cell.time - exemplar.minTime) / (exemplar.maxTime - exemplar.minTime);
  const centerX = viewConfig.horizonChartWidth * percentage;
  const x1 = centerX - snippetDestWidth / 2;
  const x2 = x1 + snippetDestWidth;
  
  // Define the destination bounding box for the snippet.
  const y1 = destY;
  const y2 = y1 - snippetDestHeight;
  const imageSnippetDestination: BBox = [x1, y1, x2, y2];
  
  // Extract the source bounding box around the cell's coordinates.
  const source = getBBoxAroundPoint(
    cell.x ?? 0,
    cell.y ?? 0,
    looneageViewStore.snippetSourceSize,
    looneageViewStore.snippetSourceSize
  );
  
  // Create a snippet selection entry.
  selections.push({
    c: 0,
    t: cell.frame - 1,
    z: 0,
    snippets: [{ source, destination: imageSnippetDestination }],
  });
  
  // Create a colormap extension and set contrast limits.
  const colormapExtension = new AdditiveColormapExtension();
  const contrastLimits = [[0, 255]];
  
  // Create and return a new CellSnippetsLayer with the computed settings.
  const cellImageLayer = new CellSnippetsLayer({
    loader: pixelSource,
    id: `cell-image-event-layer-${cell.frame}-${exemplar.trackId}`,
    contrastLimits: contrastLimits,
    selections: selections,
    channelsVisible: [true],
    extensions: [colormapExtension],
    colormap: 'viridis',
    cache: lruCache,
  });

  // Attach the computed bbox using Object.defineProperty.
  Object.defineProperty(cellImageLayer, 'snippetBBox', {
    value: imageSnippetDestination,
    writable: true,
    configurable: true,
  });

    // Find the cell's segmentation.
    const cellSegmentationPolygon = getCellSegmentationPolygon(exemplar.locationId, exemplar.trackId.toString(), cell.frame.toString());
        
    // Calculate the destination coordinates for the segmentation.
    const [x, y] = [imageSnippetDestination[0], imageSnippetDestination[1]];

    // Push the current cell's segmentation data to the segmentationData array.
    const imageSegmentationData = [];
    
    imageSegmentationData.push({
        // @ts-ignore coordinates does exist on geometry
        polygon: cellSegmentationPolygon?.geometry?.coordinates,
        hovered: cell.isHovered,
        selected: cell.isSelected,
        center: [cell.x, cell.y],
        offset: [x + (snippetDestWidth / 2), y - snippetDestHeight / 2] });

  // TODO: Segmentation Layer creation here
  // Create a new segmentation outline layer for these cells.
  const segmentationLayer = new SnippetSegmentationOutlineLayer({
        id: `snippet-segmentation-outline-layer-${exemplar.trackId}-${cell.frame}`,
        data: imageSegmentationData,
        // Use the first element of the polygon
        getPath: (d: any) => d.polygon[0],
        getColor: () => colors.hovered.rgb,
        getWidth: 1.5,
        widthUnits: 'pixels',
        jointRounded: true,
        getCenter: (d: any) => d.center,
        getTranslateOffset: (d: any) => d.offset,
        zoomX: viewStateMirror.value.zoom[0],
        scale: 1,
        clipSize: looneageViewStore.snippetDestSize,
        clip: false,
    });
  
  // The tick should be placed at the center of the snippet.
  const tickX = x1 + snippetDestWidth / 2;
  const tickY = y1
  const tickLength = viewConfiguration.value.horizonChartHeight + viewConfiguration.value.snippetHorizonChartGap*2;
  const tickData = {
    path: [
      [tickX, tickY],
      [tickX, tickY + tickLength]
    ],
    hovered: cell.isHovered,
    selected: cell.isSelected,
  };
  const cellImageTickMarkLayer = createTickMarkLayer([tickData]);

    return { tickMarkLayer: cellImageTickMarkLayer, cellImageLayer, segmentationLayer };
}

function createTickMarkLayer(tickData: any): LineLayer {
    return new LineLayer({
        id: `snippet-tick-marks-layer-${Date.now()}`,
        data: tickData,
        getSourcePosition: (d: any) => d.path[0],
        getTargetPosition: (d: any) => d.path[1],
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
}

function constructGeometry(track: ExemplarTrack): number[] {
    return constructGeometryBase(track.data, cellMetaData.timestep);
}

function getAverageAttr(exemplar: ExemplarTrack): number {
    if (!exemplar.data || exemplar.data.length === 0) return 0;
    const sum = exemplar.data.reduce((acc, d) => acc + d.value, 0);
    return sum / exemplar.data.length;
}

function createExemplarImageKeyFrameLayers(): (CellSnippetsLayer | SnippetSegmentationOutlineLayer)[] {
  const keyFrameLayers: (CellSnippetsLayer | SnippetSegmentationOutlineLayer)[] = [];
  if (!pixelSources.value) return keyFrameLayers;
  const exemplarImageUrls = exemplarViewStore.getExemplarImageUrls();
  for (const exemplar of exemplarTracksOnScreen.value) {
    const locationId = exemplar.locationId;
    if (pixelSources.value && !pixelSources.value[locationId]) {
      const url = exemplarImageUrls.get(locationId);
      if (url) {
        loadPixelSource(locationId, url);
      } else {
        console.error(`URL not found for locationId: ${locationId}`);
      }
    }
    const keyFrameLayersWrapper = createExemplarImageKeyFramesLayer(pixelSources.value[locationId], exemplar);
    if (keyFrameLayersWrapper) {
      if (keyFrameLayersWrapper.imageLayerResult.cellImageLayer) {
        keyFrameLayers.push(keyFrameLayersWrapper.imageLayerResult.cellImageLayer);
      }
      if (keyFrameLayersWrapper.imageLayerResult.segmentationLayer) {
        keyFrameLayers.push(keyFrameLayersWrapper.imageLayerResult.segmentationLayer);
      }
      if (keyFrameLayersWrapper.imageLayerResult.tickMarkLayer) {
        keyFrameLayers.push(keyFrameLayersWrapper.imageLayerResult.tickMarkLayer);
      }
    }
  }
  return keyFrameLayers;
}

function getTimeDuration(track: ExemplarTrack): number {
    let [minTime, maxTime] = getTimeExtent(track);
    return maxTime - minTime;
}

function getTimeExtent(track: ExemplarTrack): [number, number] {
    let minTime = track.minTime;
    let maxTime = track.maxTime;
    return [minTime, maxTime];
}

// Helper: Retrieves the extent of the value of the track
function valueExtent(track: ExemplarTrack): number {
    let min = Infinity;
    let max = -Infinity;
    for (let cell of track.data) {
        min = Math.min(min, cell.value);
        max = Math.max(max, cell.value);
    }
    return max - min;
}

const keyframeOrderLookup = ref<Map<string, KeyframeInfo[]>>();
function getKeyFrameOrder(exemplarTrack: ExemplarTrack): KeyframeInfo[] {
    // duplicated and modified from similar function in looneageview
    const uniqueKey = uniqueExemplarKey(exemplarTrack);
    if (keyframeOrderLookup.value == null) {
        keyframeOrderLookup.value = new Map();
    }
    if (keyframeOrderLookup.value.has(uniqueKey)) {
        return keyframeOrderLookup.value.get(uniqueKey) as KeyframeInfo[];
    }

    const L = exemplarTrack.data.length;
    // initialize scores based on the change in the attribute value
    // the first and last frames should always be
    // selected as key frames, so they get a score of zero.
    const frameScores: number[] = Array(L).fill(0);
    frameScores[0] = Infinity;
    frameScores[L - 1] = Infinity;
    const spaceKeyframesEvenly = true; // TODO: bind this to something in UI
    if (!spaceKeyframesEvenly) {
        const valExtent = valueExtent(exemplarTrack);
        if (valExtent !== 0) {
            // avoid divide by zero, if vall extent is zero, then all
            // values are the same, so the scores should be equal.
            for (let i = 1; i < L - 1; i++) {
                const prev = exemplarTrack.data[i - 1];
                const next = exemplarTrack.data[i + 1];
                const val = Math.abs(next.value - prev.value) / valExtent;
                frameScores[i] += val;
            }
        }
    }

    const frameDistances: number[] = Array(L).fill(Infinity);

    const center = 1;
    const dropOff = 3;
    const keyframeOrder: KeyframeInfo[] = [];
    const timeExtent = getTimeDuration(exemplarTrack);
    for (let i = 0; i < L; i++) {
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

        const t1 = exemplarTrack.data[maxIndex].time;

        // TODO: make d relative to tExtent, likely will have to update coverage function
        for (let i = maxIndex; i < frameDistances.length; i++) {
            const t2 = exemplarTrack.data[i].time;
            const d = Math.abs(t1 - t2);
            if (frameDistances[i] < d) break;
            frameDistances[i] = d;
        }
        for (let i = maxIndex; i >= 0; i--) {
            const t2 = exemplarTrack.data[i].time;
            exemplarTrack.data[i].time;
            const d = Math.abs(t1 - t2);
            if (frameDistances[i] < d) break;
            frameDistances[i] = d;
        }
    }
    keyframeOrderLookup.value.set(uniqueKey, keyframeOrder);
    return keyframeOrder;
}

const lruCache = new LRUCache({ max: 500 });

// Segmentation Information
const snippetSegmentationOutlineLayers = ref<SnippetSegmentationOutlineLayer[]>(
    []
);

function pointInBBox(point: [number, number], bbox: [number, number, number, number]): boolean {
    const [x, y] = point;
    const [x1, y1, x2, y2] = bbox;
    return x >= x1 && x <= x2 && y <= y1 && y >= y2;
}

// TODO: this is reusing the same cache across multiple layers which technically could have a clash if there is an identical snippet across different layers.
// Updated createExemplarImageKeyFramesLayer() with enhanced debugging:
let hoveredCoordinate = <[number, number] | null>null;
function createExemplarImageKeyFramesLayer(
  pixelSource: PixelSource<any>,
  exemplar: ExemplarTrack
): { imageLayerResult: CellImageLayerResult } {
  // --- Validation and basic setup ---
  if (!pixelSource) {
    console.error('[createExemplarImageKeyFramesLayer] pixelSource is not set!');
    return { imageLayerResult: { cellImageLayer: null, segmentationLayer: null, tickMarkLayer: null } };
  }
  if (!exemplarTracks.value || exemplarTracks.value.length === 0) {
    console.error('[createExemplarImageKeyFramesLayer] No exemplar tracks available!');
    return { imageLayerResult: { cellImageLayer: null, segmentationLayer: null, tickMarkLayer: null } };
  }

  const viewConfig = viewConfiguration.value;
  const snippetDestWidth = scaleForConstantVisualSize(viewConfig.snippetDisplayWidth);
  const snippetDestHeight = viewConfig.snippetDisplayHeight;

  // Calculate destination Y from the yOffset of the current exemplar.
  let destY = viewConfig.horizonChartHeight; // fallback
  {
    const key = uniqueExemplarKey(exemplar);
    const yOffset = exemplarRenderInfo.value.get(key)?.yOffset ?? 0;
    if (yOffset !== undefined && yOffset !== null) {
      destY =
        yOffset -
        viewConfig.timeBarHeightOuter -
        viewConfig.snippetHorizonChartGap -
        viewConfig.horizonChartHeight -
        viewConfig.snippetHorizonChartGap;
    } else {
      console.error('[createExemplarImageKeyFramesLayer] No yOffset found for key:', key);
    }
  }

  // --- Helper Functions ---
  // Calculate the destination bbox for a given cell.
  function computeDestination(cell: Cell): [number, number, number, number] {
    const percentage = (cell.time - exemplar.minTime) / (exemplar.maxTime - exemplar.minTime);
    const centerX = viewConfig.horizonChartWidth * percentage;
    const x1 = centerX - snippetDestWidth / 2;
    const x2 = x1 + snippetDestWidth;
    const y1 = destY;
    const y2 = y1 - snippetDestHeight;
    return [x1, y1, x2, y2];
  }

  // Add segmentation data given a cell, its destination, and whether it is “selected” (or hovered).
  function addSegmentation(frame: number, dest: [number, number, number, number], selected: boolean, cell: Cell) {
    if (frame <= 0) return;
    const segmentationPolygon = getCellSegmentationPolygon(
      exemplar.locationId,
      exemplar.trackId.toString(),
      frame.toString()
    );
    if (!segmentationPolygon) return;
    const [destX, destY] = [dest[0], dest[1]];
    exemplarSegmentationData.push({
      // @ts-ignore: coordinates exist on geometry
      polygon: segmentationPolygon.geometry.coordinates,
      hovered: selected,
      selected: cell.isSelected,
      center: [cell.x, cell.y],
      offset: [destX + snippetDestWidth / 2, destY - snippetDestHeight / 2],
    });
  }

  // Convert a duration to its display width.
  const convertDurationToWidth = (duration: number): number => {
    return (viewConfig.horizonChartWidth * duration) / (exemplar.maxTime - exemplar.minTime);
  };

  // --- Initialize arrays for selections, segmentation and tick data ---
  let selections: Selection[] = [];
  const exemplarSegmentationData: any[] = [];
  const tickData: any[] = [];
  let hoveredFound = ref(false);

  // --- Loop 1: Process hovered images (prev, current, next) ---
  const margin = 2;
  const keyFrames = getKeyFrameOrder(exemplar);
  for (const { index, nearestDistance } of keyFrames) {
    const cell = exemplar.data[index];
    const nearestDistanceWidth = convertDurationToWidth(nearestDistance);
    if (nearestDistanceWidth <= snippetDestWidth + 4) break;
    const destination = computeDestination(cell);

    // Check if the hovered pointer falls within this destination.
    if (pointInBBox(hoveredCoordinate ?? [-1000, 0], destination)) {
      // Compute neighboring destinations.
      const [x1, y1, x2, y2] = destination;
      const prevCellDest: [number, number, number, number] = [
        x1 - snippetDestWidth - margin,
        y1,
        x2 - snippetDestWidth - margin,
        y2
      ];
      const nextCellDest: [number, number, number, number] = [
        x1 + snippetDestWidth + margin,
        y1,
        x2 + snippetDestWidth + margin,
        y2
      ];

      hoveredFound.value = true;
      hoveredImagesInfo.value = [
        [prevCellDest, cell],
        [nextCellDest, cell],
        [destination, cell]
      ];

      // Push selections for previous, current and next locations.
      selections.push(
        { c: 0, t: cell.frame - 2, z: 0, snippets: [{ source: getBBoxAroundPoint(cell.x, cell.y, looneageViewStore.snippetSourceSize, looneageViewStore.snippetSourceSize), destination: prevCellDest }] },
        { c: 0, t: cell.frame - 1, z: 0, snippets: [{ source: getBBoxAroundPoint(cell.x, cell.y, looneageViewStore.snippetSourceSize, looneageViewStore.snippetSourceSize), destination: destination }] },
        { c: 0, t: cell.frame, z: 0, snippets: [{ source: getBBoxAroundPoint(cell.x, cell.y, looneageViewStore.snippetSourceSize, looneageViewStore.snippetSourceSize), destination: nextCellDest }] }
      );

      // Add segmentation for these three destinations.
      addSegmentation(cell.frame, destination, true, cell);
      addSegmentation(cell.frame - 1, prevCellDest, true, cell);
      addSegmentation(cell.frame + 1, nextCellDest, true, cell);

      // Compute tick data using the snippet center.
      const tickX = x1 + snippetDestWidth / 2;
      const tickLength = viewConfig.horizonChartHeight + viewConfig.snippetHorizonChartGap * 2;
      tickData.push({
        path: [
          [tickX, y1],
          [tickX, y1 + tickLength]
        ],
        hovered: cell.isHovered,
        selected: cell.isSelected,
      });
    }
  }

  // --- Loop 2: Process non-hovered keyframes, checking for collisions ---
  // Combine bounding boxes of already interacted cells.
  const hoveredCellBBoxes = hoveredCellsInfo.value ? hoveredCellsInfo.value.map(info => info[0]) : [];
  const selectedCellBBoxes = selectedCellsInfo.value ? selectedCellsInfo.value.map(info => info[0]) : [];
  const interactedCellBBoxes = [...hoveredCellBBoxes, ...selectedCellBBoxes, ...(hoveredImagesInfo.value ? hoveredImagesInfo.value.map(info => info[0]) : [])];

  for (const { index, nearestDistance } of keyFrames) {
    const cell = exemplar.data[index];
    const nearestDistanceWidth = convertDurationToWidth(nearestDistance);
    if (nearestDistanceWidth <= snippetDestWidth + 4) break;
    const destination = computeDestination(cell);

    // Check for collisions.
    const cellCollisionDetected = interactedCellBBoxes.some(bbox => rectsOverlap(destination, bbox));
    if (!cellCollisionDetected) {
      // Normal keyframe selection and segmentation.
      selections.push({
        c: 0,
        t: cell.frame - 1,
        z: 0,
        snippets: [{
          source: getBBoxAroundPoint(cell.x, cell.y, looneageViewStore.snippetSourceSize, looneageViewStore.snippetSourceSize),
          destination: destination
        }]
      });
      addSegmentation(cell.frame, destination, false, cell);

      // Add tick mark for this snippet.
      const [x1, y1, , ] = destination;
      const tickX = x1 + snippetDestWidth / 2;
      const tickLength = viewConfig.horizonChartHeight + viewConfig.snippetHorizonChartGap * 2;
      tickData.push({
        path: [
          [tickX, y1],
          [tickX, y1 + tickLength]
        ],
        hovered: cell.isHovered,
        selected: cell.isSelected,
      });
    }
  }

  if (!hoveredFound.value) {
    hoveredImagesInfo.value = [];
  }

  // --- Create layer instances using the computed data ---
  const colormapExtension = new AdditiveColormapExtension();
  const contrastLimits = [[0, 255]];
  const snippetLayer = new CellSnippetsLayer({
    id: `test-cell-snippets-layer ${exemplar.trackId}`,
    loader: pixelSource,
    onHover: (info: PickingInfo) => {
      if (info.coordinate && info.coordinate.length === 2) {
        hoveredCoordinate = [info.coordinate[0], info.coordinate[1]];
      }
      renderDeckGL();
    },
    contrastLimits,
    channelsVisible: [true],
    selections: selections,
    extensions: [colormapExtension],
    colormap: 'viridis',
    cache: lruCache,
  });

  const hoveredWithAlpha = colors.hovered.rgba;
  hoveredWithAlpha[3] = 200;
  const snippetSegmentationOutlineLayer = new SnippetSegmentationOutlineLayer({
    id: `snippet-segmentation-outline-layer-${exemplar.trackId}-${Date.now()}`,
    data: exemplarSegmentationData,
    getPath: (d: any) => d.polygon[0],
    getColor: (d: any) => {
      if (d.selected) return globalSettings.normalizedSelectedRgb;
      if (d.hovered) return hoveredWithAlpha;
      return colors.unselectedBoundary.rgb;
    },
    getWidth: (d: any) => (d.hovered ? 3 : 1.5),
    opacity: 1,
    widthUnits: 'pixels',
    jointRounded: true,
    getCenter: (d: any) => d.center,
    getTranslateOffset: (d: any) => d.offset,
    zoomX: viewStateMirror.value.zoom[0],
    scale: 1,
    clipSize: looneageViewStore.snippetDestSize,
    clip: false,
  });

  const keyFrameTickMarkLayer = createTickMarkLayer(tickData);

  return { imageLayerResult: { cellImageLayer: snippetLayer, segmentationLayer: snippetSegmentationOutlineLayer, tickMarkLayer: keyFrameTickMarkLayer } };
}

// General purpose watchers ---------------------------------------------------------------------------------------------------
// Watch for changes in histogramDomains, conditionHistograms, and exemplarTracks
watch(
    () => [
        histogramDomains.value, 
        conditionHistograms.value, 
        exemplarTracks.value
    ],
    () => {
        if (exemplarDataInitialized.value) {
            renderDeckGL();
        }
    },
    { deep: true }
);

watch(
    () => conditionSelectorStore.conditionColorMap,
    (newConditionColorMap) => {
        if (exemplarDataInitialized.value && newConditionColorMap) {
            renderDeckGL();
        }
    },
    { deep: true }
);
// General purpose helpers --------------------------------------------------------------------------------------------------

const conditionKey = ref<'conditionOne' | 'conditionTwo'>('conditionOne');
// If we sense a change in selectedYTag, conditionKey toggles between condition one and two.
watch(
    () => conditionSelectorStore.selectedYTag,
    () => {
        if (conditionKey.value === 'conditionTwo') {
            conditionKey.value = 'conditionOne';
        }
        else {
            conditionKey.value = 'conditionTwo';
        }
    },
);

// Add a new watch to trigger renderDeckGL when conditionKey changes
watch(
    () => conditionKey.value,
    () => {
        if (exemplarDataInitialized.value) {
            renderDeckGL();
        }
    }
);

// Finds the fill color for the exemplar track based on the selected Y tag.
const fillColor = (exemplar: ExemplarTrack | undefined) => {
    if (
        !exemplar ||
        !exemplar.tags ||
        !exemplar.tags.conditionTwo ||
        !exemplar.tags.conditionOne
    ) {
        console.log('Failing validation check with:', {
            exemplarExists: !!exemplar,
            tagsExist: !!exemplar?.tags,
            conditionTwoExists: !!exemplar?.tags?.conditionTwo,
            conditionOneExists: !!exemplar?.tags?.conditionOne
        });
        return [0, 0, 0];
    }

    // Value (Example, 4HT, Ethanol, etc).
    const conditionKeyValue = exemplar.tags?.[conditionKey.value];
    const hexColor = conditionSelectorStore.conditionColorMap[conditionKeyValue];
    
    if (!hexColor) {
        console.error(`No color found for key: "${conditionKey}" in colorMap:`, conditionSelectorStore.conditionColorMap);
        return [0, 0, 0];
    }
    else return hexToRgb(hexColor);
};

// Formatters -----------------------------------------------------------------------------------------------------------------
function customNumberFormatter(num: number, defaultFormat: string): string {
    if (num % 1 === 0) {
        return format('.0f')(num);
    } else {
        return format(defaultFormat)(num);
    }
}

/**
 * @returns {string} A unique key for the exemplar track, combining trackId and locationId.
 */
function uniqueExemplarKey(exemplar: ExemplarTrack): string {
    return exemplar.trackId + '-' + exemplar.locationId;
}

const hexToRgb = (hex: string): [number, number, number] => {
    // Remove '#' if present
    hex = hex.replace(/^#/, '');

    // Parse the RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
};

// Determines if the exemplar view should be shown yet -------------------------
const isExemplarViewReady = computed(() => {
    return exemplarDataLoaded.value && exemplarDataInitialized;
});
</script>

<template>
    <div v-if="!isExemplarViewReady" class="spinner-container">
        <q-spinner color="primary" size="3em" :thickness="10" />
        <div>
            {{
                `Loading ${exemplarViewStore.selectedAggregation.value} ${exemplarViewStore.selectedAttribute}`
            }}
        </div>
    </div>
    <div v-show="isExemplarViewReady">
        <canvas
            v-show="experimentDataInitialized"
            id="exemplar-deckgl-canvas"
            ref="deckGlContainer"
        ></canvas>
    </div>
</template>

<style scoped lang="scss">
.spinner-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1em;
}
</style>
