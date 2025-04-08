<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, render, nextTick } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import { DetailView, getChannelStats, loadOmeTiff } from '@hms-dbmi/viv';
import type { PixelData, PixelSource } from '@vivjs/types';
import {
    ScatterplotLayer,
    PolygonLayer,
    LineLayer,
    TextLayer,
} from '@deck.gl/layers';
import { QSpinner } from 'quasar';
import {
    type Cell,
    type ExemplarTrack,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
import {
    type BBox,
    getBBoxAroundPoint,
    overlaps1D,
    scaleLengthForConstantVisualSize,
} from '@/util/imageSnippets';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { storeToRefs } from 'pinia';
import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';
import SnippetSegmentationOutlineLayer from '../layers/SnippetSegmentationOutlineLayer/SnippetSegmentationOutlineLayer';
import CellSnippetsLayer from '../layers/CellSnippetsLayer';
import { type Selection } from '../layers/CellSnippetsLayer';
import {
    constructGeometryBase,
    hexListToRgba,
    HORIZON_CHART_MOD_OFFSETS,
} from './deckglUtil';
import { isEqual, cloneDeep, clamp } from 'lodash';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useConfigStore } from '@/stores/misc/configStore';
import Pool from '@/util/Pool';
import { LRUCache } from 'lru-cache';
import { AdditiveColormapExtension } from '@hms-dbmi/viv';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import {
    type SelectedSnippet,
    useLooneageViewStore,
} from '@/stores/componentStores/looneageViewStore';
import { format } from 'd3-format';
import { ScrollUpDownController } from './ScrollUpDownController';
import colors from '@/util/colors';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import type { Feature } from 'geojson';
import type { Polygon } from 'geojson';

 
const globalSettings = useGlobalSettings();
const { darkMode } = storeToRefs(globalSettings);

const configStore = useConfigStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const imageViewerStore = useImageViewerStore();
const { contrastLimitSlider } = storeToRefs(imageViewerStoreUntrracked);

const deckGlContainer = ref<HTMLCanvasElement | null>(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

const exemplarViewStore = useExemplarViewStore();
const conditionSelectorStore = useConditionSelectorStore();

const cellMetaData = useCellMetaData();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const { hoveredCellIndex } = storeToRefs(dataPointSelectionUntrracked);
const looneageViewStore = useLooneageViewStore();

const segmentationStore = useSegmentationStore();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentLocationMetadata } = storeToRefs(
    datasetSelectionStore
);

const {
    viewConfiguration,
    exemplarTracks,
    exemplarHeight,
    conditionHistograms,
    histogramDomains,
    loadingExemplarData,
    selectedAttribute,
} = storeToRefs(exemplarViewStore);
const { getHistogramData } = exemplarViewStore;

// Reactive reference for totalExperimentTime
const totalExperimentTime = ref(0);

// Reactive Deck.gl instance
const deckgl = ref<any | null>(null);

// 1. Introduce exemplarDataInitialized
const exemplarDataInitialized = ref(false);

// Access the condition selector store
const conditionSelector = useConditionSelectorStore();
const { selectedYTag } = storeToRefs(conditionSelector);


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
    for (let i = 0; i < solverIterations; i++) {
        zoomX = Math.log2(deckGlWidth.value / visualizationWidth(zoomX));
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
    // const buffer = includeBuffer ? viewportBuffer.value : 0;
    const buffer = 200;
    const width = scaleForConstantVisualSize(deckGlWidth.value + buffer);
    // const width = deckGlWidth.value + buffer;
    // const height = scaleForConstantVisualSize(deckGlHeight.value + buffer, 'y');
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
    () => experimentDataInitialized.value,
    async (initialized) => {
        if (initialized) {
            console.log('Experiment data initialized.');

            // Fetch total experiment time
            totalExperimentTime.value =
                await exemplarViewStore.getTotalExperimentTime();

            const exemplarPercentiles = [5, 50, 95];
            await exemplarViewStore.getExemplarTracks(
                true,
                exemplarPercentiles,
                undefined
            );
            console.log('Exemplar tracks generated.');

            await getHistogramData();
            console.log('Histogram data fetched.');

            // Initialize Deck.gl if not already initialized
            if (!deckgl.value) {
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
                                hoveredCell.value !== null
                                    ? customNumberFormatter(
                                          hoveredCell.value.value,
                                          '.3f'
                                      )
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
        } else {
            // If not initialized, clean up Deck.gl instance
            if (deckgl.value) {
                deckgl.value.finalize();
                deckgl.value = null;
                console.log('Deck.gl instance finalized and removed.');
            }
            totalExperimentTime.value = 0;

            // Reset exemplarDataInitialized
            exemplarDataInitialized.value = false;
        }
    },
    { immediate: false } // We don't need to run this immediately on mount
);

// Loading Image Data ---------------------------------------------------------------------------

const pixelSources = ref<{ [key: string]: PixelSource<any> } | null>(null);
const loader = ref<any | null>(null);
// const testRaster = ref<any | null>(null);

// Debug watch to see when currentLocationMetadata becomes available.
watch(
    currentLocationMetadata,
    (newMeta) => {
        console.log('[ExemplarView] currentLocationMetadata changed:', newMeta);
    },
    { immediate: true }
);

// Watch pixelSources so you can see when it gets set.
watch(
    pixelSources,
    (newVal) => {
        if (newVal) {
            // console.log('[ExemplarView] pixelSources loaded:', newVal);
        } else {
            console.warn('[ExemplarView] pixelSources is still null.');
        }
    },
    { immediate: true }
);

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

    // Update image dimensions from metadata
    // imageViewerStoreUntrracked.sizeX =
    //     loader.value.metadata.Pixels.SizeX;
    // imageViewerStoreUntrracked.sizeY =
    //     loader.value.metadata.Pixels.SizeY;
    // imageViewerStoreUntrracked.sizeT =
    //     loader.value.metadata.Pixels.SizeT;

    // testRaster.value = await loader.value.data[0].getRaster({
    //     selection: { c: 0, t: 0, z: 0 },
    // });

    // if (testRaster.value == null) {
    //     console.warn('[ExemplarView] testRaster is null.');
    //     return;
    // }

    // const copy = testRaster.value.data.slice();
    // const channelStats = getChannelStats(copy);
    // contrastLimitSlider.value.min = channelStats.contrastLimits[0];
    // contrastLimitSlider.value.max = channelStats.contrastLimits[1];
    // imageViewerStore.contrastLimitExtentSlider.min =
    //     channelStats.domain[0];
    // imageViewerStore.contrastLimitExtentSlider.max =
    //     channelStats.domain[1];

    // If pixelSources.value is null, first initialize it as an empty object.
    if (!pixelSources.value) {
        pixelSources.value = {};
    }

    // Reassign pixelSources.value with the new key as the first property.
    pixelSources.value[locationId] = loader.value.data[0];
}

async function loadPixelSources() {
    const exemplarUrls = exemplarViewStore.getExemplarUrls();
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
// Watches for changes in currentLocationMetadata and loads the pixel source.
watch(
    exemplarDataInitialized, 
    async () => {
        try {
            console.log('Exemplar Data Initialized. Loading Pixel Sources.');
            await loadPixelSources();
            // Optionally, trigger render after pixelSources loads:
            renderDeckGL();
        } catch (error) {
            console.error('[ExemplarView] Error loading pixel sources:', error);
        }
    },
    { immediate: true }
);

// --------------------------------------------------------------------------------------------

// 4. Add a new watcher on exemplarDataInitialized.
// TODO: Move exemplarDataInitialized to the store
watch(
    exemplarDataInitialized,
    (initialized) => {
        if (initialized) {
            renderDeckGL();
        }
    },
    { immediate: false }
);

// Clean up Deck.gl on component unmount
onBeforeUnmount(() => {
    if (deckgl.value) {
        deckgl.value.finalize();
        deckgl.value = null;
    }
    // 5. Reset exemplarDataInitialized on unmount
    exemplarDataInitialized.value = false;
});

let deckGLLayers: any[] = [];

// Function to render Deck.gl layers
async function renderDeckGL(): Promise<void> {
    if (!deckgl.value) return;

    recalculateExemplarYOffsets();

    deckGLLayers = [];

    deckGLLayers.push(createSidewaysHistogramLayer());
    deckGLLayers.push(createHorizonChartLayer());
    deckGLLayers.push(createTimeWindowLayer());
    deckGLLayers.push(createKeyFrameImageLayers());
    deckGLLayers = deckGLLayers.concat(selectedCellImageLayers.value);
    deckGLLayers = deckGLLayers.concat(hoveredCellImageLayer.value);
    
    // Save segmentation data for every cell
    const segmentationResults = await segmentationStore.getCellSegmentations(cellMetaData.cellArray || []);
    cellSegmentationData.value = (segmentationResults || []).filter(
        (feature): feature is Feature<Polygon> => feature.geometry.type === 'Polygon'
    );

    deckGLLayers = deckGLLayers.concat(snippetSegmentationOutlineLayers.value);
    deckGLLayers = deckGLLayers.filter((layer) => layer !== null);


    deckgl.value.setProps({
        layers: deckGLLayers,
    });
    deckgl.value.redraw();
}

const exemplarTracksOnScreen = computed<ExemplarTrack[]>(() => {
    return exemplarTracks.value.filter((exemplar) => {
        const renderInfo = exemplarRenderInfo.value.get(
            uniqueExemplarKey(exemplar)
        );
        return renderInfo ? renderInfo.onScreen : false;
    });
});

const exemplarRenderInfo = ref(new Map<string, ExemplarRenderInfo>());

interface ExemplarRenderInfo {
    yOffset: number;
    onScreen: boolean;
}

const bottomYOffset = computed(() => {
    return Math.max(
        ...Array.from(exemplarRenderInfo.value.values()).map(
            (renderInfo: ExemplarRenderInfo) => renderInfo.yOffset
        )
    );
});

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

function customNumberFormatter(num: number, defaultFormat: string): string {
    if (num % 1 === 0) {
        return format('.0f')(num);
    } else {
        return format(defaultFormat)(num);
    }
}

function uniqueExemplarKey(exemplar: ExemplarTrack): string {
    return exemplar.trackId + '-' + exemplar.locationId;
}

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
const hexToRgb = (hex: string): [number, number, number] => {
    // Remove '#' if present
    hex = hex.replace(/^#/, '');

    // Parse the RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
};

// wait for conditionSelectorStore to be initialized
const fillColor = (exemplar: ExemplarTrack | undefined) => {
    if (
        !exemplar ||
        !exemplar.tags ||
        !exemplar.tags.conc ||
        !exemplar.tags.drug
    ) {
        // console.log(`Invalid exemplar or missing property:`, exemplar);
        return [0, 0, 0]; // Default black color
    }
    let conditionKey = '';

    if (selectedYTag.value === 'Drug') {
        conditionKey = exemplar.tags.drug;
    } else {
        conditionKey = exemplar.tags.conc;
    }
    const hexColor = conditionSelectorStore.conditionColorMap[conditionKey];

    if (!hexColor) {
        console.error(`No color found for key: ${conditionKey}`);
        return [0, 0, 0]; // Default color in case of error
    }

    // Convert hex to RGB
    const rgbList = hexToRgb(hexColor);
    return rgbList;
};
watch(
    () => conditionSelectorStore.conditionColorMap,
    (newConditionColorMap) => {
        if (exemplarDataInitialized.value && newConditionColorMap) {
            renderDeckGL();
        }
    },
    { deep: true }
);

function createHorizonChartLayer(): HorizonChartLayer[] | null {
    const horizonChartLayers: HorizonChartLayer[] = [];

    // Get the global min and max values for every exemplar, for color scaling.
    const tracks = exemplarViewStore.exemplarTracks;
    const exemplarTracksMin =
        tracks.length > 0 ? Math.min(...tracks.map((t) => t.minValue)) : 0;
    const exemplarTracksMax =
        tracks.length > 0 ? Math.max(...tracks.map((t) => t.maxValue)) : 0;

    for (const exemplar of exemplarTracksOnScreen.value) {
        // console.log(exemplar.tags);
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
                onHover: (info: PickingInfo, event: any) =>
                    handleHorizonHover(info, exemplar),
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
        // If the current exemplar is hovered, create an extra outline layer.
    if (hoveredExemplar.value && hoveredExemplar.value.trackId === exemplar.trackId) {
      const outlinePolygon = [
        // Create a rectangle matching the destination of the horizon chart.
        [0, yOffset],
        [viewConfiguration.value.horizonChartWidth, yOffset],
        [viewConfiguration.value.horizonChartWidth, yOffset - viewConfiguration.value.horizonChartHeight],
        [0, yOffset - viewConfiguration.value.horizonChartHeight],
        [0, yOffset], // Close the polygon.
      ];

      const outlineLayer = new PolygonLayer({
        id: `exemplar-horizon-chart-outline-${uniqueExemplarKey(exemplar)}`,
        data: [{ polygon: outlinePolygon }],
        pickable: false,
        stroked: true,
        filled: false,
        getPolygon: (d: any) => d.polygon,
        getLineColor: (d: any) => colors.hovered.rgb,
        getLineWidth: () => 4, // Adjust the thickness as needed.
        lineWidthUnits: "pixels",
        updateTriggers: {
          // Re-render the outline when hover changes.
          hoveredExemplar: hoveredExemplar.value,
        },
      });
      horizonChartLayers.push(outlineLayer);
    }
    }
    return horizonChartLayers;
}

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

// The currently hovered exemplar and its currently hovered value.
const selectedExemplar = ref<ExemplarTrack | null>(null);
const selectedCell = ref<Cell | null>(null);
const selectedCellImageLayers = ref<CellSnippetsLayer[]>([]);
// The currently hovered exemplar and its currently hovered value.
const hoveredExemplar = ref<ExemplarTrack | null>(null);
const hoveredCell = ref<Cell | null>(null);
const hoveredCellImageLayer = ref<CellSnippetsLayer[]>([]);

/**
 * Handles cell image events for both click and hover actions.
 * It calculates the corresponding time point from the click/hover coordinate,
 * retrieves the relevant cell, and creates the appropriate image layer.
 */
function handleCellImageEvents(
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
  const cellImageEventsLayer = createCellImageEventLayer(pixelSource, exemplar, cell);
  if (!cellImageEventsLayer) {
    console.error('[handleHorizonCellImages] selectedLayer is null');
    return;
  }

  // Update state based on the action type (click or hover)
  if (action === 'click') {
    selectedExemplar.value = exemplar;
    selectedCell.value = cell;
    selectedCellImageLayers.value.push(cellImageEventsLayer);
  } else if (action === 'hover') {
    hoveredExemplar.value = exemplar;
    hoveredCell.value = cell;
    // Reset hovered layers before adding the new layer
    hoveredCellImageLayer.value = [cellImageEventsLayer];
  }

  // Re-render Deck.gl layers
  renderDeckGL();
}

/**
 * Createel a cell image layer for click/hover events.
 * This function computes the destination coordinates for the snippet
 * based on the cell's time position and returns a new CellSnippetsLayer.
 */
function createCellImageEventLayer(
  pixelSource: PixelSource<any>,
  exemplar: ExemplarTrack,
  cell: Cell
): CellSnippetsLayer | null {
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
  const cellImageEventLayer = new CellSnippetsLayer({
    loader: pixelSource,
    id: `cell-image-event-layer-${cell.frame}-${exemplar.trackId}`,
    contrastLimits: contrastLimits,
    selections: selections,
    channelsVisible: [true],
    extensions: [colormapExtension],
    colormap: 'viridis',
    cache: lruCache,
  });

  // TODO: Segmentation Layer creation here
  
  return cellImageEventLayer;
}

function handleHorizonHover(info: PickingInfo, exemplar: ExemplarTrack) {
    if (!info.index || info.index === -1) {
        hoveredExemplar.value = null;
    hoveredCell.value = null;
    renderDeckGL();
        return;
    }
    handleCellImageEvents(info, exemplar, 'hover');
}

function handleHorizonClick(info: PickingInfo, exemplar: ExemplarTrack) {
    if (!info.index || info.index === -1) {
        return;
    }
    handleCellImageEvents(info, exemplar, 'click');
}

function constructGeometry(track: ExemplarTrack): number[] {
    return constructGeometryBase(track.data, cellMetaData.timestep);
}

function createTimeWindowLayer(): PolygonLayer[] | null {
    // TODO: implement
    const placeholderLayer: PolygonLayer[] = [];

    // Testing
    // console.log('Total Experiment Time:', totalExperimentTime.value);
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

interface TextDatum {
    coordinates: [number, number];
    drug: string;
    conc: string;
}

function getAverageAttr(exemplar: ExemplarTrack): number {
    if (!exemplar.data || exemplar.data.length === 0) return 0;
    const sum = exemplar.data.reduce((acc, d) => acc + d.value, 0);
    return sum / exemplar.data.length;
}

function createSidewaysHistogramLayer(): any[] | null {
    const layers: any[] = [];

    // Group exemplars by condition (drug + conc)
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
        const drug = firstExemplar.tags.drug;
        const conc = firstExemplar.tags.conc;

        // Find histogram data for this group
        const histogramDataForGroup =
            conditionHistograms.value.find(
                (ch) =>
                    ch.condition.Drug === drug &&
                    ch.condition['Concentration (um)'] === conc
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
                target: [hGap, yOffset],
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

        const textData: TextDatum[] = [
            {
                coordinates: [-hGap - 0.1 * histWidth, yOffset],
                drug: drug,
                conc: conc,
            },
        ];

        layers.push(
            new TextLayer({
                id: `exemplar-sideways-histogram-text-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: textData,
                getPosition: (d: TextDatum) => d.coordinates,
                getText: (d: TextDatum) => `${d.drug} ${d.conc}`,
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

interface Pin {
    source: number[];
    target: number[];
    exemplar: ExemplarTrack;
    id: string;
    color?: number[];
}

const tempPin = ref<Pin | null>(null);
const tempLabel = ref<{ text: string; position: [number, number] } | null>(
    null
);
const pinnedPins = ref<Pin[]>([]);
const dragPin = ref<Pin | null>(null);

// -----------------------------------------------------------------------------
// UPDATED: Handle hovering on the histogram hover box.
// This function now updates the temporary pin (or clears it if the pointer
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

// -----------------------------------------------------------------------------
// NEW: When the histogram hover box is clicked, pin the current temporary pin.
// The current temporary pin is added to the pinnedPins array, a dummy event is logged,
// and the temporary pin is cleared so that future hovering creates a new one.
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

// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// NEW: Create deck.gl layers for pins from an array of pin data.
// In this example we build a LineLayer (to draw horizontal connector lines)
// and a ScatterplotLayer (to draw the circle endpoints that are pickable/interactive).
function createPinLayers(pins: any[], firstExemplar: ExemplarTrack) {
    const pinLayers = [];
    pinLayers.push(
        new LineLayer({
            id: `exemplar-pin-lines-${uniqueExemplarKey(firstExemplar)}`,
            data: pins,
            pickable: false,
            getSourcePosition: (d: any) => d.source,
            getTargetPosition: (d: any) => d.target,
            getColor: (d: Pin) =>
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
            getColor: (d: Pin) =>
                hoveredExemplar.value === d.exemplar
                ? colors.hovered.rgb
                : d.color
                ? d.color
                : fillColor(d.exemplar),
            getFillColor: (d: Pin) =>
                hoveredExemplar.value === d.exemplar
                ? colors.hovered.rgb
                : d.color
                ? d.color
                : fillColor(d.exemplar),
            // When a pin is clicked, dragged or released, we log a dummy event.
            onClick: (info: PickingInfo, event: any) =>
                handlePinClick(info, event, firstExemplar),
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

// -----------------------------------------------------------------------------
// NEW: Dummy event handlers for interacting with pins.
// These log a message whenever a pin is clicked or dragged.
function handlePinClick(
    info: PickingInfo,
    event: any,
    firstExemplar: ExemplarTrack
) {
    console.log('Dummy event: Pin clicked', info.object);
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

// End of Pin Layer Creation
// ---------------------------------------------------------------

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

function createKeyFrameImageLayers(): CellSnippetsLayer[] {
    if (!pixelSources.value) {
        return [];
    }
    const keyFrameImageLayers: CellSnippetsLayer[] = [];
    for (const exemplar of exemplarTracksOnScreen.value) {
        const locationId = exemplar.locationId;
        const exemplarUrls = exemplarViewStore.getExemplarUrls();
        if (pixelSources.value && !pixelSources.value[locationId]) {
            const url = exemplarUrls.get(locationId);
            if (url) {
                loadPixelSource(locationId, url);
            } else {
                console.error(`URL not found for locationId: ${locationId}`);
            }
        }
        const exemplarImageKeyFramesLayer = createExemplarImageKeyFramesLayer(
            pixelSources.value[locationId],
            exemplar
        );
        if (exemplarImageKeyFramesLayer) {
            keyFrameImageLayers.push(exemplarImageKeyFramesLayer);
        }
    }
    return keyFrameImageLayers;
}

function valueExtent(track: ExemplarTrack): number {
    let min = Infinity;
    let max = -Infinity;
    for (let cell of track.data) {
        min = Math.min(min, cell.value);
        max = Math.max(max, cell.value);
    }
    return max - min;
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

interface KeyframeInfo {
    index: number;
    nearestDistance: number;
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
const cellSegmentationData = ref<Feature[]>();

// TODO: this is reusing the same cache across multiple layers which technically could have a clash if there is an identical snippet across different layers.
// Updated createExemplarImageKeyFramesLayer() with enhanced debugging:
function createExemplarImageKeyFramesLayer(
    pixelSource: PixelSource<any>,
    exemplar: ExemplarTrack
): CellSnippetsLayer | null {
    let selections: Selection[] = [];
    // Check that the pixelSource is ready.
    if (!pixelSource) {
        console.error(
            '[createExemplarImageKeyFramesLayer] pixelSource.value is not set!'
        );
        console.warn(
            '[createExemplarImageKeyFramesLayer] pixelSource might not have loaded yet. Is loadOmeTiff() being called and awaited?'
        );
        return null; // Do not create the layer until pixelSource.value is available.
    }

    // Check that exemplarTracks is available.
    if (!exemplarTracks.value || exemplarTracks.value.length === 0) {
        console.error(
            '[createExemplarImageKeyFramesLayer] No exemplar tracks available!'
        );
        return null;
    }

    // Get viewConfiguration details for snippet placement.
    const viewConfig = viewConfiguration.value;
    // const snippetWidth = viewConfig.snippetDisplayWidth;
    const snippetDestWidth = scaleForConstantVisualSize(
        viewConfig.snippetDisplayWidth
    );
    const snippetDestHeight = viewConfig.snippetDisplayHeight;

    // Calculate destination Y for the snippets.
    let destY = viewConfig.horizonChartHeight; // fallback value
    if (exemplarTracks.value && exemplarTracks.value.length > 0) {
        const key = uniqueExemplarKey(exemplar);
        const yOffset = exemplarRenderInfo.value.get(key)?.yOffset ?? 0;
        if (yOffset === undefined || yOffset == null) {
            console.error(
                '[createExemplarImageKeyFramesLayer] No yOffset found for first exemplar with key:',
                key
            );
        } else {
            // Compute destination Y such that the snippet is just above the top horizon chart.
            destY =
                yOffset -
                viewConfig.timeBarHeightOuter -
                viewConfig.snippetHorizonChartGap -
                viewConfig.horizonChartHeight -
                viewConfig.snippetHorizonChartGap;
        }
    }

    const convertDurationToWidth = (duration: number) => {
        return (
            (viewConfiguration.value.horizonChartWidth * duration) /
            (exemplar.maxTime - exemplar.minTime)
        );
    };
    const keyFrames = getKeyFrameOrder(exemplar);
    for (const { index, nearestDistance } of keyFrames) {
        const nearestDistanceWidth = convertDurationToWidth(nearestDistance);
        if (nearestDistanceWidth <= snippetDestWidth) {
            break;
        }

        // Find the cell in exemplar.data whose time is closest to 'time'
        const cell = exemplar.data[index];

        const source = getBBoxAroundPoint(
            cell.x,
            cell.y,
            looneageViewStore.snippetSourceSize,
            looneageViewStore.snippetSourceSize
        );

        // Find the percentage of that time to the total experiment time.
        const percentage =
            (cell.time - exemplar.minTime) /
            (exemplar.maxTime - exemplar.minTime);

        // Find the x coordinate based on the percentage.
        const centerX = viewConfig.horizonChartWidth * percentage;
        const x1 = centerX - snippetDestWidth / 2;
        const x2 = x1 + snippetDestWidth;
        const y1 = destY;
        const y2 = y1 - snippetDestHeight;
        const destination: BBox = [x1, y1, x2, y2];

        selections.push({
            c: 0,
            t: cell.frame - 1,
            z: 0,
            snippets: [{ source, destination }],
        });
    }

    // Create an instance of the colormap extension.
    const colormapExtension = new AdditiveColormapExtension();
    // Set up a basic LRUCache for snippet data.
    // Setup contrast limits and channel visibility.
    const contrastLimits = [[0, 255]];
    const channelsVisible = [true];
    // Return an array of CellSnippetsLayer instances, one for each pixel source.
    const snippetLayer = new CellSnippetsLayer({
        id: `test-cell-snippets-layer ${exemplar.trackId}`,
        loader: pixelSource, // the loaded image data
        contrastLimits,
        channelsVisible,
        selections: selections,
        extensions: [colormapExtension],
        colormap: 'viridis',
        cache: lruCache,
    });

    // Build segmentation data for each cell/snippet.
    const segmentationData = exemplar.data.map(cell => {
        const feature = cellSegmentationData.value?.find(
                (feature) =>
                    feature?.properties?.frame == cell.frame
            );
        console.log("Feature:", feature);
        // Check if geometry is a Polygon before accessing coordinates
        const polygon =
            feature && feature.geometry.type === 'Polygon'
            ? (feature.geometry as Polygon).coordinates
            : undefined;
        console.log("Seg Polygon:", polygon);
        return {
            polygon: polygon,
            isHovered: cell.isHovered,
            selected: cell.isSelected,
            center: [cell.x, cell.y],
            offset: [0,0],
        };
    })
    .filter((d) => d.polygon !== undefined);

    console.log("Segmentation Data Final:", segmentationData);

    // Create a new segmentation outline layer for these cells.
    const snippetSegmentationOutlineLayer = new SnippetSegmentationOutlineLayer({
        id: `snippet-segmentation-outline-layer-${exemplar.trackId}`,
        data: segmentationData.filter((d) => !d.isHovered),
        // Use the first element of the polygon
        getPath: (d) => d.polygon[0],
        getColor: () => colors.hovered.rgb,
        getWidth: 2,
        widthUnits: 'pixels',
        jointRounded: true,
        getCenter: (d: any) => d.center,
        getTranslateOffset: (d: any) => d.offset,
        zoomX: viewStateMirror.value.zoom[0],
        scale: looneageViewStore.snippetZoom,
        clipSize: looneageViewStore.snippetDestSize,
        clip: true,
    });
    
    // Push the segmentation layer to be rendered alongside the snippet layer.
    snippetSegmentationOutlineLayers.value.push(snippetSegmentationOutlineLayer);

    return snippetLayer;
}

// 1. Watch for changes in histogramDomains or conditionHistograms to re-render Deck.gl
watch(
    () => [histogramDomains.value, conditionHistograms.value],
    () => {
        if (exemplarDataInitialized.value) {
            renderDeckGL();
        }
    },
    { deep: true }
);

// 2. Also watch for changes in exemplarTracks
watch(
    () => exemplarTracks.value,
    () => {
        if (exemplarDataInitialized.value) {
            renderDeckGL();
        }
    },
    { deep: true }
);

// Optionally, watch selectedAttribute and selectedAggregation for debugging
watch(
    () => [
        exemplarViewStore.selectedAttribute,
        exemplarViewStore.selectedAggregation,
    ],
    (newValues) => {
        console.log('Selected Attribute and Aggregation changed:', newValues);
    }
);

watch(loadingExemplarData, (newVal) => {
    console.log('loadingExemplarData changed:', newVal);
});

const isExemplarViewReady = computed(() => {
    return !loadingExemplarData.value && exemplarDataInitialized;
});
</script>

<template>
    <div v-if="!isExemplarViewReady" class="spinner-container">
        <!-- The loading message includes the current aggregation and attribute -->
        <q-spinner color="primary" size="3em" :thickness="10" />
        <div>
            {{
                `Loading ${exemplarViewStore.selectedAggregation.value} ${exemplarViewStore.selectedAttribute}`
            }}
        </div>
    </div>
    <div v-if="isExemplarViewReady">
        <canvas
            v-if="experimentDataInitialized"
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
