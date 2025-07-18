<script setup lang="ts">
// Vue and core libraries
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { until, useElementSize } from '@vueuse/core';

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
    type SelectedTrackRequest,
    horizonChartScheme,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useDataPointSelection } from '@/stores/interactionStores/dataPointSelectionTrrackedStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { useConfigStore } from '@/stores/misc/configStore';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useSegmentationStore } from '@/stores/dataStores/segmentationStore';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';

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
    rectsOverlap,
    pointInBBox,
    getExemplarColor,
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
import SnippetSegmentationLayer from '../layers/SnippetSegmentationLayer/SnippetSegmentationLayer';
import {
    schemeReds,
    schemeBlues,
} from 'd3-scale-chromatic';

// The y-position and visibility of each exemplar track.
interface ExemplarRenderInfo {
    yOffset: number;
    onScreen: boolean;
}

interface combinedSnippetSegmentationLayer {
    snippetSegmentationOutlineLayer: SnippetSegmentationOutlineLayer | null;
    snippetSegmentationLayer: SnippetSegmentationLayer | null;
}
// Combined layers for a cell snippet: cell image, segmentation outline, and tick marks.
interface FinalCellImageLayer {
  cellImageLayer: CellSnippetsLayer | null;
  segmentationLayer: combinedSnippetSegmentationLayer | null;
  tickMarkLayer: LineLayer | null;
  imageOutlineLayer?: PolygonLayer | null; // Add this new optional property
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
const { experimentDataInitialized, currentLocationMetadata, currentExperimentFilename} = storeToRefs(
    datasetSelectionStore
);

// Data Stores
const exemplarViewStore = useExemplarViewStore();
const {
    viewConfiguration,
    snippetZoom,
    exemplarTracks,
    exemplarHeight,
    conditionHistograms,
    histogramDomains,
    exemplarDataLoaded,
    selectedAttribute,
    selectedAggregation,
    selectedAttr2,
    selectedVar1,
    horizonChartSettings,
    histogramYAxisLabel,
    addAggregateColumnForSelection,
    getAttributeName,
} = storeToRefs(exemplarViewStore);
const imageViewerStore = useImageViewerStore();
const selectedAttributeName = computed(() => exemplarViewStore.getAttributeName());

const cellMetaData = useCellMetaData();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const dataPointSelection = useDataPointSelection();


// Dark mode settings
const globalSettings = useGlobalSettings();
const { darkMode } = storeToRefs(globalSettings);

// Create a colormap extension and set contrast limits.
const colormapExtension = new AdditiveColormapExtension();
const contrastLimits = [[0, 255]];

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
    safeRenderDeckGL();
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
    safeRenderDeckGL();
}



// Fully re-load data & initialize Deck.gl when experiment data is loaded, selected attribute / aggregation, and filters.
watch(
  [experimentDataInitialized, selectedAttribute, selectedAggregation, selectedAttr2, selectedVar1],
  // 2. destructure all four
  async ([initialized, tracks]) => {
        if (!initialized) {
            // If not initialized, clean up Deck.gl instance
            if (deckgl.value) {
                deckgl.value.finalize();
                deckgl.value = null;
            }
            totalExperimentTime.value = 0;

            // Reset exemplarDataInitialized
            exemplarDataInitialized.value = false;
            return;
        }
        exemplarDataInitialized.value = false;

        // Reset the horizon chart settings to default for numeric recalculation
        horizonChartSettings.value.default = true;

        // Load exemplar data -----------------------

        if (selectedAttribute.value === ""){
            selectedAttribute.value = undefined;
        }
        await exemplarViewStore.addAggregateColumnForSelection(
            selectedAttribute.value,
            selectedAggregation.value,
            selectedAttr2.value,
            selectedVar1.value
        );

        // Fetch total experiment time
        totalExperimentTime.value = await exemplarViewStore.getTotalExperimentTime();

        
        // Fetch exemplar tracks & histogram data
        await exemplarViewStore.getExemplarViewData(true, exemplarViewStore.exemplarPercentiles);
        
        // Fetch Images
        await loadPixelSources();

        // Fetch all segmentations
        await getCellSegmentationData();
        horizonChartSettings.default = true;
        // Initialize Deck.gl if not already initialized -----------------
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
                        hoveredCellsInfo.value && hoveredCellsInfo.value.length > 0
                            ? customNumberFormatter(hoveredCellsInfo.value[0][1].value, '.3f')
                            : '';
                        // If any of these values are undefined, return null
                        if (
                            hoveredExemplar.value == null ||
                            formattedTime == null ||
                            formattedValue == null
                        ) {
                            return null;
                        }
                        // Create the tooltip HTML, with the currently hovered exemplar and time.
                        let html = `<h5>Cell Track: ${hoveredExemplar.value?.trackId}</h5>`;
                        html += `<div>Time: ${formattedTime}</div>`;
                        html += `<div>${selectedAttributeName.value}: ${formattedValue}</div>`;
                        html += `<div>Location: ${hoveredExemplar.value?.locationId}</div>`;
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
                    if (exemplarDataInitialized.value) {
                        renderDeckGL();
                    }
                    return viewState;
                },
                onClick: (info: PickingInfo) => {
                    // If nothing was picked (empty space), deselect everything
                    if (!info.object && !info.layer) {
                        handleEmptySpaceClick();
                    }
                },
            });
        }
        // Finally, render the Deck.gl layers
        await renderDeckGL();
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        // Set exemplarDataInitialized to true after data generation
        exemplarDataInitialized.value = true;
    },
    { immediate: false } // We don't need to run this immediately on mount
);


// Main rendering function for DeckGL -------------------------------------------------------------------
let deckGLLayers: any[] = [];

const selectedCellImageTickMarkLayers = ref<LineLayer[]>([]);

// Function to render Deck.gl layers
async function renderDeckGL(): Promise<void> {
    if (!deckgl.value) return;
    // Find which exemplar tracks are currently on screen.
    recalculateExemplarYOffsets();

    // Create deck gl Layers ----------------------------------------------
    deckGLLayers = [];
    // Histograms -------------------
    deckGLLayers.push(createSidewaysHistogramLayer());

    // Horizon Charts (Data over time) with text ---------
    deckGLLayers.push(createHorizonChartLayer());
    if (horizonTextLayer.value) {
        deckGLLayers.push(horizonTextLayer.value);
    }

    // Cell Images ------------------
    deckGLLayers.push(...createExemplarImageKeyFrameLayers());
    deckGLLayers = deckGLLayers.concat(selectedCellImageLayers.value);
    deckGLLayers = deckGLLayers.concat(hoveredOutlineLayer.value);
    deckGLLayers = deckGLLayers.concat(selectedOutlineLayer.value);
    deckGLLayers = deckGLLayers.concat(snippetSegmentationOutlineLayers.value);
    deckGLLayers = deckGLLayers.concat(selectedCellImageTickMarkLayers.value);

    // Time bar for cell lifespan
    deckGLLayers.push(createTimeWindowLayer());

    // Draw layers --------------------------------------------
    // Filter out null layers
    deckGLLayers = deckGLLayers.filter((layer) => layer !== null);

    deckgl.value.setProps({
        layers: deckGLLayers,
    });
    deckgl.value.redraw();
}
// Render deck gl layers only when the exemplar data is initialized
function safeRenderDeckGL() {
  if (exemplarDataInitialized.value) {
    renderDeckGL();
  }
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

// Add a new function to handle deselection when clicking empty space
function handleEmptySpaceClick() {
    // Clear all selections
    selectedExemplar.value = null;
    selectedOutlineLayer.value = null;
    selectedCellsInfo.value = [];
    selectedCellImageLayers.value = [];
    snippetSegmentationOutlineLayers.value = [];
    selectedCellImageTickMarkLayers.value = [];
    dataPointSelection.selectedTrackId = null;
    dataPointSelection.setCurrentFrameIndex(0);
    safeRenderDeckGL();
}

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


// Segmentation Data for current tracks
let cellSegmentationData = ref<LocationSegmentation[]>([]);

watch(
    () => exemplarViewStore.exemplarDataLoaded,
    async (loaded) => {
      if (loaded) {
        // reload your tiffs and segmentation for the new tracks
        await loadPixelSources();
        // clear old segmentations and fetch them for the new tracks
        cellSegmentationData.value = [];
        await getCellSegmentationData();
        // repaint
        safeRenderDeckGL();
      }
    }
  );
// Populate cellSegmentationData with all segmentation data for all cells in exemplar tracks ONCE.
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
            viewConfiguration.value.timeBarHeightOuter -
            viewConfiguration.value.horizonTimeBarGap;

        // TODO: probably skip if not in viewport


        // If the exemplar has no data, create a dummy track with the min value.
        let timeExtent: [number, number];
        let geometryData: number[];

        if (
            !exemplar.data ||
            exemplar.data.length < 2 ||
            exemplar.minTime === exemplar.maxTime
        ) {
            timeExtent = [0, totalExperimentTime.value];

            const value =
            exemplar.data && exemplar.data.length
                ? exemplar.data[0].value
                : 0;
            const dummyTrack = [
            { time: 0, value },
            { time: totalExperimentTime.value, value },
            ];
            geometryData = constructGeometryBase(dummyTrack, cellMetaData.timestep);
        } else {
            timeExtent = [exemplar.minTime, exemplar.maxTime];
            geometryData = constructGeometry(exemplar);
        }

        // Initialize horizon chart settings if default is true
        if (horizonChartSettings.value.default || 
            !horizonChartSettings.value.positiveColorScheme.value || 
            horizonChartSettings.value.positiveColorScheme.value.length === 0) {
            
            const modHeight = (exemplarTracksMax - exemplarTracksMin) /
            (horizonChartScheme.length - 1);
            const baseline = exemplarTracksMin;
            
            horizonChartSettings.value.default = false;
            
            // Only set color schemes if user hasn't modified them
            if (!horizonChartSettings.value.userModifiedColors) {
                horizonChartSettings.value.positiveColorScheme = { 
                    label: "Grey (Default)", 
                    value: horizonChartScheme
                };
                horizonChartSettings.value.negativeColorScheme = { 
                    label: "Grey (Default)", 
                    value: horizonChartScheme
                };
            }
            
            // Always recalculate numeric values when switching aggregation/attribute
            horizonChartSettings.value.modHeight = modHeight;
            horizonChartSettings.value.baseline = baseline;
            // Reset the numeric modification flag since we're recalculating
            horizonChartSettings.value.userModifiedNumeric = false;
        } else {
            // Only update numeric values if user hasn't manually modified them
            if (!horizonChartSettings.value.userModifiedNumeric) {
                const modHeight = (exemplarTracksMax - exemplarTracksMin) /
                (horizonChartSettings.value.positiveColorScheme.value.length - 1);
                const baseline = exemplarTracksMin;
                
                horizonChartSettings.value.modHeight = modHeight;
                horizonChartSettings.value.baseline = baseline;
            }
        }
        const horizonChartCustomId = `exemplar-horizon-chart-${uniqueExemplarKey(exemplar)}-${horizonChartSettings.value.positiveColorScheme.label}-${horizonChartSettings.value.negativeColorScheme.label}`;

        horizonChartLayers.push(
            new HorizonChartLayer({
                id: horizonChartCustomId,
                data: HORIZON_CHART_MOD_OFFSETS,
                pickable: false,
                instanceData: geometryData,
                destination: [
                    yOffset,
                    0,
                    viewConfiguration.value.horizonChartWidth,
                    viewConfiguration.value.horizonChartHeight,
                ],
                dataXExtent: timeExtent,
                baseline: horizonChartSettings.value.baseline,
                binSize: horizonChartSettings.value.modHeight,
                getModOffset: (d: any) => d,
                // Use the same approach as LooneageView - access the 6th element of the color scheme
                positiveColors: hexListToRgba(horizonChartSettings.value.positiveColorScheme.value),
                negativeColors: hexListToRgba(horizonChartSettings.value.negativeColorScheme.value),
                updateTriggers: {
                    instanceData: geometryData,
                    positiveColors: hexListToRgba(horizonChartSettings.value.positiveColorScheme.value),
                    negativeColors: hexListToRgba(horizonChartSettings.value.negativeColorScheme.value),
                },
            })
        );

        // FOR CLICKING AND HOVERING ON THE HORIZON CHART
        horizonChartLayers.push(
            new PolygonLayer({
                id: `exemplar-horizon-chart-clickbox-${uniqueExemplarKey(exemplar)}`,
                data: [{ exemplar }], // single box per chart
                pickable: true,
                getPolygon: () => {
                    // Use the same destination as the horizon chart
                    const [yOffset, left, width, height] = [
                        renderInfo.yOffset -
                            viewConfiguration.value.timeBarHeightOuter -
                            viewConfiguration.value.horizonTimeBarGap,
                        0,
                        viewConfiguration.value.horizonChartWidth,
                        viewConfiguration.value.horizonChartHeight,
                    ];
                    return [
                        [left, yOffset],
                        [left + width, yOffset],
                        [left + width, yOffset - height],
                        [left, yOffset - height],
                        [left, yOffset],
                    ];
                },
                getFillColor: [0, 0, 0, 0], // fully transparent
                getLineWidth: 0,
                onHover: (info: PickingInfo, event: any) => {
                    handleHorizonHover(info, exemplar);
                },
                onClick: (info: PickingInfo, event: any) => {
                    handleHorizonClick(info, exemplar);
                },
                updateTriggers: {
                    getPolygon: [
                        renderInfo.yOffset,
                        viewConfiguration.value.horizonChartWidth,
                        viewConfiguration.value.horizonChartHeight,
                    ],
                    instanceData: geometryData,
                },
            })
        );
    }
    return horizonChartLayers;
}
const selectedOutlineLayer = ref<PolygonLayer|null>(null);

function createSelectedHorizonOutlineLayer(exemplar: ExemplarTrack) {
  const key = uniqueExemplarKey(exemplar);
  const info = exemplarRenderInfo.value.get(key);
  if (!info) { selectedOutlineLayer.value = null; return; }
  const y = info.yOffset - viewConfiguration.value.timeBarHeightOuter - viewConfiguration.value.horizonTimeBarGap;
  selectedOutlineLayer.value = new PolygonLayer({
    id: `exemplar-selected-outline-${key}`,
    data: [{ polygon: [
      [0, y],
      [viewConfiguration.value.horizonChartWidth, y],
      [viewConfiguration.value.horizonChartWidth, y - viewConfiguration.value.horizonChartHeight],
      [0, y - viewConfiguration.value.horizonChartHeight],
      [0, y]
    ] }],
    pickable: false,
    stroked: true,
    filled: false,
    getPolygon: d => d.polygon,
    getLineColor: globalSettings.normalizedSelectedRgb,
    getLineWidth: viewConfiguration.value.hoveredLineWidth,
    lineWidthUnits: 'pixels'
  });
}

// Create a reactive reference for the hovered outline layer.
const hoveredOutlineLayer = ref<PolygonLayer | null>(null);
const horizonTextLayer = ref<TextLayer | null>(null);

function createHoveredHorizonOutlineLayer() {
  // Find the exemplar corresponding to the hovered value
  if (!hoveredExemplar.value) {
    hoveredOutlineLayer.value = null;
    horizonTextLayer.value = null;
    return;
  }
  const exemplar = hoveredExemplar.value;
  const renderInfo = exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar));
  if (!renderInfo) return;
  const yOffset =
    renderInfo.yOffset -
    viewConfiguration.value.timeBarHeightOuter -
    viewConfiguration.value.horizonTimeBarGap;

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
    getLineWidth: () => viewConfiguration.value.hoveredLineWidth,
    lineWidthUnits: "pixels",
    updateTriggers: {
      hoveredExemplar: hoveredExemplar.value,
    },
});

  const label = selectedAttributeName.value;
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
        getBackgroundColor: [255, 255, 255, 160],
    });
}

// Event handlers for horizon chart interactions
function handleHorizonHover(info: PickingInfo, exemplar: ExemplarTrack) {

    // Set hoveredExemplar based on the info index
    if (info.index === undefined || info.index === -1) {
        hoveredExemplar.value = null;
        hoveredCellsInfo.value = [];
        hoveredOutlineLayer.value = null;
        horizonTextLayer.value = null;
        safeRenderDeckGL();
        return;
    }
    hoveredExemplar.value = exemplar;
    createHoveredHorizonOutlineLayer();

    // Cell image + segmentation appears on mouse hover
    const cellImageEventsLayer = createCellImageEventsLayer(info, exemplar, 'hover');
    if (!cellImageEventsLayer) return;

    const hoveredFinalImageLayers: any[] = [];
    // Back - segmentation backing
    if (
      viewConfiguration.value.showSnippetOutline &&
      cellImageEventsLayer.segmentationLayer?.snippetSegmentationLayer
    ) {
      hoveredFinalImageLayers.push(
        cellImageEventsLayer.segmentationLayer.snippetSegmentationLayer
      );
    }
    // Image
    if (viewConfiguration.value.showSnippetImage && cellImageEventsLayer.cellImageLayer) {
      hoveredFinalImageLayers.push(cellImageEventsLayer.cellImageLayer);
    }
    // Add the hovered image outline
    if (cellImageEventsLayer.imageOutlineLayer) {
      hoveredFinalImageLayers.push(cellImageEventsLayer.imageOutlineLayer);
    }
    // Segmentation front outline
    if (
      viewConfiguration.value.showSnippetOutline &&
      cellImageEventsLayer.segmentationLayer?.snippetSegmentationOutlineLayer
    ) {
      hoveredFinalImageLayers.push(
        cellImageEventsLayer.segmentationLayer.snippetSegmentationOutlineLayer
      );
    }
    // Tick marks
    if (cellImageEventsLayer.tickMarkLayer) {
        hoveredFinalImageLayers.push(cellImageEventsLayer.tickMarkLayer);
    }

    deckgl.value?.setProps({
        layers: [
        ...deckGLLayers,
        ...hoveredFinalImageLayers
        ]
    });
}

async function handleHorizonClick(info: PickingInfo, exemplar: ExemplarTrack) {
    // Remove the deselection logic - always select a new section
    
    // Calculate the time from the click coordinate
    let realTimePoint = null;
    const X = info.coordinate?.[0];
    if (X != null) {
        const { horizonChartWidth } = viewConfiguration.value;
        const estimatedTime = Math.max(
            0,
            exemplar.minTime +
                (exemplar.maxTime - exemplar.minTime) * (X / horizonChartWidth)
        );
        
        // Compute the real time point from the exemplar data
        realTimePoint = computeRealTimePoint(exemplar, estimatedTime);
        console.log("Exemplar selected time:", realTimePoint);
    }

    // 1) select new exemplar
    selectedExemplar.value = exemplar;
    dataPointSelection.selectedTrackId = exemplar.trackId;

    createSelectedHorizonOutlineLayer(exemplar);
    createCellImageEventsLayer(info, exemplar, 'click');

    // 2) switch location (this kicks off async re-init of cellMetaData)
    const meta = datasetSelectionStore.currentExperimentMetadata;
    const loc = meta?.locationMetadataList?.find((l) => l.id === exemplar.locationId);
    if (loc) {
        datasetSelectionStore.selectImagingLocation(loc);

        // wait for cellMetaData to finish loading
        await until(() => cellMetaData.dataInitialized).toBe(true);
        // then wait until selectedTrack is non-null
        await until(() => cellMetaData.selectedTrack != null).toBeTruthy();
    }

    // 3) now read the computed safely and set the frame index after everything is loaded
    const track = cellMetaData.selectedTrack!;
    dataPointSelection.selectedLineageId = cellMetaData.getLineageId(track);
    
    // Set the current frame index after the cell metadata is fully loaded
    if (realTimePoint !== null) {
        dataPointSelection.setCurrentFrameIndex(realTimePoint);
    }

    // 4) Force a complete re-render of all layers to update selected state
    safeRenderDeckGL();
}

// Time Window Layer -------------------------------------------------------------------------------------------
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
            getFillColor: [128, 128, 128, 255],
            opacity: 0.5,
            stroked: (exemplar: ExemplarTrack) => 
                hoveredExemplar.value?.trackId === exemplar.trackId ||
                selectedExemplar.value?.trackId === exemplar.trackId,
            getLineColor: (exemplar: ExemplarTrack) => 
                getExemplarColor(
                    exemplar,
                    selectedExemplar.value,
                    hoveredExemplar.value,
                    [128, 128, 128, 255],
                    fillColor
                ),
            getLineWidth: (exemplar: ExemplarTrack) => 
                hoveredExemplar.value?.trackId === exemplar.trackId ||
                selectedExemplar.value?.trackId === exemplar.trackId ? viewConfiguration.value.hoveredLineWidth : 0,
            lineWidthUnits: 'pixels',
            updateTriggers: {
                getPolygon: {
                    selectedAttribute: selectedAttribute.value,
                },
                getFillColor: {
                    selectedAttribute: selectedAttribute.value,
                },
                stroked: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
                getLineColor: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
                getLineWidth: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
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
            stroked: (exemplar: ExemplarTrack) => 
                hoveredExemplar.value?.trackId === exemplar.trackId || 
                selectedExemplar.value?.trackId === exemplar.trackId,
            getLineColor: (exemplar: ExemplarTrack) => 
                getExemplarColor(
                    exemplar,
                    selectedExemplar.value,
                    hoveredExemplar.value,
                    [0, 0, 0, 0],
                    fillColor
                ),
            getLineWidth: (exemplar: ExemplarTrack) => 
                hoveredExemplar.value?.trackId === exemplar.trackId || 
                selectedExemplar.value?.trackId === exemplar.trackId ? viewConfiguration.value.hoveredLineWidth : 0,
            lineWidthUnits: 'pixels',
            updateTriggers: {
                getPolygon: {
                    selectedAttribute: selectedAttribute.value,
                },
                getFillColor: {
                    selectedAttribute: selectedAttribute.value,
                },
                stroked: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
                getLineColor: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
                getLineWidth: [hoveredExemplar.value?.trackId, selectedExemplar.value?.trackId],
            },
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

    // { histogramBinRanges, minX, maxX, minY, maxY }
    const domains = histogramDomains.value;

    // For each group of exemplars, create a sideways histogram layer
    for (const group of groupedExemplars) {
        if (group.length === 0) continue;

        // Get the condition key and conditions for this group
        const conditionGroupKey = group[0];
        const conditionOne = conditionGroupKey.tags.conditionOne;
        const conditionTwo = conditionGroupKey.tags.conditionTwo;

        // Find histogram data for this group
        const histogramDataForGroup =
            conditionHistograms.value.find(
                (ch) =>
                    ch.condition.conditionOne === conditionOne &&
                    ch.condition.conditionTwo === conditionTwo
            )?.histogramData || [];

        // Basic geometry for the condition grouping
        const firstOffset =
            exemplarRenderInfo.value.get(uniqueExemplarKey(conditionGroupKey))
                ?.yOffset ?? 0;
        const lastOffset =
            exemplarRenderInfo.value.get(
                uniqueExemplarKey(group[group.length - 1])
            )?.yOffset ?? 0;
        const groupTop = firstOffset - exemplarHeight.value;
        const groupBottom = lastOffset;
        const groupHeight = groupBottom - groupTop;
        const binWidth = groupHeight / histogramDataForGroup.length;

        // Create the histogram pins ----------------------------
        // Histogram pins (with circles) initialization
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

        // For each exemplar in the group, create a corresponding pin in the histogram
        for (const exemplar of group) {
            // Find the bin index corresponding to the attribute value of the exemplar
            const aggValue = exemplar.aggValue
            const binIndex = domains.histogramBinRanges.findIndex(
                (bin) => aggValue >= bin.min && aggValue < bin.max
            );
            // If out of range, skip
            if (binIndex < 0) {
                continue;
            }
            
            // Get the bin range
            const binRange = domains.histogramBinRanges[binIndex];
            
            // Compute y-position based on where aggValue falls within the bin range
            const y0 = groupTop + binIndex * binWidth;
            const y1 = y0 + binWidth;
            
            // Interpolate position within the bin based on aggValue
            const binProgress = (aggValue - binRange.min) / (binRange.max - binRange.min);
            const yPosition = y0 + (binProgress * binWidth);

            // Horizontal Length of the pin line
            const fixedLineLength = histWidth;
            const x0 = hGap;
            const x1 = x0 + fixedLineLength;

            // Push the pin line geometry using interpolated position
            pinData.push({
                source: [-x0, yPosition],
                target: [-(x0 + fixedLineLength), yPosition],
                exemplar,
            });
            
            // Connecting line from end of pin to the corresponding horizon chart ----
            // Find the y position of this exemplar
            const yOffset =
                exemplarRenderInfo.value.get(uniqueExemplarKey(exemplar))
                    ?.yOffset ??
                0 -
                    viewConfiguration.value.timeBarHeightOuter -
                    viewConfiguration.value.horizonTimeBarGap;
            // Draw the connecting line using interpolated position
            pinToHorizonChartData.push({
                source: [-x0, yPosition],
                target: [0, yOffset - viewConfiguration.value.horizonTimeBarGap],
                exemplar,
            });
        }

        // Draw Histograms ------------------------------------------------
        const histogramBaseLineX = -hGap + viewConfiguration.value.histogramFontSize;
        // Draw the base thick line
        layers.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-base-line-${uniqueExemplarKey(
                    conditionGroupKey
                )}`,
                data: [group],
                getSourcePosition: () => [histogramBaseLineX, groupBottom],
                getTargetPosition: () => [histogramBaseLineX, groupTop],
                getColor: fillColor(conditionGroupKey),
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
            const x0 = hGap;
            const x1 = x0 + (count / domains.maxY) * (histWidth);
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
                    conditionGroupKey
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
                    conditionGroupKey
                )}`,
                pickable: true,
                data: [group],
                getPolygon: () => {
                    return [
                        [-hGap, groupBottom],
                        [-hGap - histWidth, groupBottom],
                        [-hGap - histWidth, groupTop],
                        [-hGap, groupTop],
                        [-hGap, groupBottom],
                    ];
                },
                getFillColor: [0, 0, 0, 0],
                getLineWidth: 0,
                onHover: (info: PickingInfo, event: any) =>
                    handleHistogramHover(
                        info,
                        event,
                        conditionGroupKey,
                        histogramValues
                    ),
                onClick: (info: PickingInfo, event: any) =>
                    handleHistogramClick(
                        info,
                        event,
                        conditionGroupKey,
                        histogramValues,
                        groupBottom,
                        groupTop
                    ),
            })
        );


        // Create the histogram pin layers
        layers.push(...createPinLayers(pinData, conditionGroupKey));

        // Push a new LineLayer to draw these lines with thinner stroke
        layers.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-lines-${uniqueExemplarKey(
                    conditionGroupKey
                )}`,
                data: pinToHorizonChartData,
                pickable: false,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: (d: { exemplar: ExemplarTrack }) =>
                    getExemplarColor(
                        d.exemplar,
                        selectedExemplar.value,
                        hoveredExemplar.value,
                        undefined,
                        fillColor
                    ),
                getWidth: (d: {
                    source: [number, number];
                    target: [number, number];
                    exemplar: ExemplarTrack;
                }) =>
                    hoveredExemplar.value === d.exemplar || selectedExemplar.value === d.exemplar
                        ? viewConfiguration.value.hoveredLineWidth
                        : 1, // Thinner stroke width
                opacity: 1,
            })
        );

        // Condition Text Layer -----------------------------------
        const conditionGroupMiddleY = (groupBottom + groupTop) / 2;


        const conditionFontSize = viewConfiguration.value.histogramFontSize;
        const maxTextWidth = groupBottom - groupTop;
        const horizonHistogramGap = viewConfiguration.value.horizonHistogramGap;
        const conditionGroupTextData: HistogramTextData[] = [
            {
                coordinates: [histogramBaseLineX + conditionFontSize, conditionGroupMiddleY],
                conditionOne,
                conditionTwo,
            },
        ];
        layers.push(
            new TextLayer({
                id: `sideways-conditions-histogram-text-${uniqueExemplarKey(
                    conditionGroupKey
                )}`,
                data: conditionGroupTextData,
                getPosition: (d: HistogramTextData) => d.coordinates,
                getText: (d: HistogramTextData) => `${d.conditionOne} ${d.conditionTwo}`,
                sizeScale: 1,
                sizeUnits: 'pixels',
                sizeMaxPixels: conditionFontSize,
                getAngle: 90,
                getColor: fillColor(conditionGroupKey),
                background: true,
                getBackgroundColor: [255, 255, 255, 160],
                billboard: true,
                textAnchor: 'bottom',
                alignmentBaseline: 'bottom',
                wordBreak: 'break-word',
                maxWidth: maxTextWidth / conditionFontSize,
            })
        );

        // Histogram X-Axis Label Text Layer -------------------

        // Place the histogram X-axis label at the top of the sideways histogram
        // (Normal text orientation, not rotated)

        // Text should not be much longer than the histogram width
        histWidth = scaleForConstantVisualSize(viewConfiguration.value.histogramWidth);
        const fontSize = viewConfiguration.value.histogramFontSize * 0.7;
        const widthBuffer = 5;
        const maxWidth = histWidth / (fontSize - widthBuffer);

        layers.push(
            new TextLayer({
                id: `sideways-histogram-x-axis-label-${uniqueExemplarKey(conditionGroupKey)}`,
                data: [
                    {
                        coordinates: [histogramBaseLineX - viewConfiguration.value.histogramFontSize / 2, groupTop],
                        label: histogramYAxisLabel.value,
                    },
                ],
                getPosition: (d: any) => d.coordinates,
                getText: (d: any) => d.label,
                sizeScale: 1,
                sizeUnits: 'pixels',
                sizeMaxPixels: fontSize,
                getAngle: 90,
                getColor: [120, 120, 120],
                background: true,
                backgroundColor: [255, 255, 255, 200],
                billboard: true,
                getTextAnchor: 'end',
                getAlignmentBaseline: 'center',
                wordBreak: 'break-word',
                maxWidth: maxWidth
            })
        );
    }

    return layers;
}

// Histogram Pins ------------------------------------------------------
const hoveredPin = ref<HistogramPin | null>(null);
const hoveredPinLabel = ref<{ text: string; position: [number, number] } | null>(null);
const pinnedPins = ref<HistogramPin[]>([]);
const dragPin = ref<HistogramPin | null>(null);

// Helper function that takes a

// Handle hovering on the histogram hover box. This function now updates the temporary pin (or clears it if the pointer
// has left the hovered area) and then calls updatePinsLayer() to re-render all pins.
function handleHistogramHover(
    info: PickingInfo,
    event: any,
    conditionGroupKey: ExemplarTrack,
    histogramData: any[]
) {
    // When the pointer leaves the polygon (info.index === -1) or no coordinate,
    // clear the temporary pin.
    if (!info.coordinate || info.index === -1) {
        hoveredPin.value = null;
        hoveredPinLabel.value = null;
        updatePinsLayer(conditionGroupKey);
        return;
    }
    // Otherwise, compute the pin position based on the mouse coordinate.
    const hoveredY = info.coordinate[1];
    let { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
    hGap = scaleForConstantVisualSize(hGap);
    histWidth = scaleForConstantVisualSize(histWidth);
    const fixedLineLength = histWidth;
    const x0 = hGap;

    // Set the temporary pin: positioned at the hoveredY
    hoveredPin.value = {
        source: [-x0, hoveredY],
        target: [-(x0 + fixedLineLength), hoveredY],
        exemplar: conditionGroupKey,
        id: 'temp', // a temporary identifier
    };

    // Find the bin index & count of the hoveredY, using the histogramValues
    const binIndex = histogramData.findIndex(
        (d) => d.y0 <= hoveredY && d.y1 >= hoveredY
    );

    if (binIndex === -1) {
        hoveredPinLabel.value = null;
        updatePinsLayer(conditionGroupKey);
        return;
    }

    // Get the bin's count and the min/max attribute values
    const bin = histogramData[binIndex];
    const count = bin.count;

    const [minStr, maxStr] = [bin.minAttr, bin.maxAttr].map((x) =>
        (Math.trunc(x * 1000) / 1000).toFixed(2)
    );

    // Set the temporary label: positioned 10 pixels left of the pin circle.
    hoveredPinLabel.value = {
        text: `Cell Count: ${count}\n --- \n${histogramYAxisLabel.value} between:\n[${minStr}, ${maxStr}]`,
        position: [-(x0 + fixedLineLength), hoveredY + 10],
    };

    updatePinsLayer(conditionGroupKey);
}

// When the histogram hover box is clicked, create a pinned pin.
// The current temporary pin is added to the pinnedPins array and temporary pin is cleared
async function handleHistogramClick(
    info: PickingInfo,
    event: any,
    conditionGroupKey: ExemplarTrack,
    histogramData: any[],
    histogramBottomY: number,
    histogramTopY: number
) {
    // If the click has no coordinate
    if (!info.coordinate) return;

    if (hoveredPin.value) {

        // Create a new pinned pin object with a color and unique ID.
        const newPinnedPin = {
            ...hoveredPin.value,
            id: `pinned-${Date.now()}`,
            color: fillColor(hoveredPin.value.exemplar),
        };
        pinnedPins.value.push(newPinnedPin);

        // For each exemplar group ...
        // Add a new exemplar track for the p-value (percentile) selected by the clicked pin ---

        // First, get the hoveredY from the info coordinate.
        const hoveredY = info.coordinate[1];

        // Find the bin index & count of the hoveredY, using the histogramValues
        const binIndex = histogramData.findIndex(
            (d) => d.y0 <= hoveredY && d.y1 >= hoveredY
        );
        // If the bin index is -1, reset.
        if (binIndex === -1) {
            hoveredPinLabel.value = null;
            updatePinsLayer(conditionGroupKey);
            return;
        }

        // Get the bin's information
        const bin = histogramData[binIndex];

        const selectedTrackRequest: SelectedTrackRequest = {
            binRange: [histogramData[binIndex].minAttr, histogramData[binIndex].maxAttr],
            conditionGroupKey: {
                conditionOne: String(hoveredPin.value.exemplar.tags.conditionOne),
                conditionTwo: String(hoveredPin.value.exemplar.tags.conditionTwo)
            }
        };
        // --- Finally, create new exemplar tracks for the p-value, for each condition group ---
        await exemplarViewStore.getExemplarViewData(
            false,
            undefined,
            selectedTrackRequest
        );

        // Re-load the cell images.
        await loadPixelSources();

        // Re-render all deck gl layers.
        safeRenderDeckGL();
    }
}

// Helper function to update the pins layer.
// Combines any pinned pins with the temporary pin (if it exists) and updates
// deck.gl's layers to include both the base layers and the pin layers.
function updatePinsLayer(conditionGroupKey: ExemplarTrack) {
    const allPins = [...pinnedPins.value];
    if (hoveredPin.value) {
        allPins.push(hoveredPin.value);
    }

    const pinLayers = createPinLayers(allPins, conditionGroupKey);

    // If a hoveredPinLabel exists, add a TextLayer.
    if (hoveredPinLabel.value) {
        let { histogramWidth: histWidth, histogramTooltipFontSize: fontSize} = viewConfiguration.value;
        histWidth = histWidth;
        const maxWidth = (histWidth / fontSize) * 0.7;
        pinLayers.push(
            new TextLayer({
                id: `histogram-tooltip-text-${uniqueExemplarKey(conditionGroupKey)}`,
                data: [hoveredPinLabel.value],
                getPosition: (d: {
                    text: string;
                    position: [number, number];
                }) => d.position,
                getText: (d: { text: string }) => d.text,
                sizeScale: 1,
                sizeUnits: 'pixels',
                sizeMaxPixels: fontSize,
                getColor: (d: any) => [0, 0, 0],
                getTextAnchor: (d: any) => 'start',
                getAlignmentBaseline: (d: any) => 'top',
                background: true,
                getBackgroundColor: [255, 255, 255, 160],
                billboard: true,
                wordBreak: 'break-word',
                maxWidth,
                getSize: () => fontSize,
            })
        );
    }

    deckgl.value.setProps({
        layers: [...deckGLLayers, ...pinLayers],
        controller: true,
    });
}

// Create pin layers for the histogram pins.
function createPinLayers(pins: any[], conditionGroupKey: ExemplarTrack) {
    const pinLayers = [];
    // Exemplar Pin Lines -------
    pinLayers.push(
        new LineLayer({
            id: `exemplar-pin-lines-${uniqueExemplarKey(conditionGroupKey)}`,
            data: pins,
            pickable: false,
            getSourcePosition: (d: any) => d.source,
            getTargetPosition: (d: any) => d.target,
            getColor: (d: HistogramPin) =>
                getExemplarColor(
                        d.exemplar,
                        selectedExemplar.value,
                        hoveredExemplar.value,
                        d.color,
                        fillColor
                    ),
            // Adjust the line width based on hover state.
            getWidth: (d: any) =>
                hoveredExemplar.value === d.exemplar || selectedExemplar.value === d.exemplar
                    ? viewConfiguration.value.hoveredLineWidth
                    : 1,
            opacity: 0.2,
        })
    );
    // Exemplar Pin circles at end of lines -------
    const circleData = pins.map((d) => ({
        position: d.target,
        exemplar: d.exemplar,
        id: d.id,
    }));
    pinLayers.push(
        new ScatterplotLayer({
            id: `exemplar-pin-circles-${uniqueExemplarKey(conditionGroupKey)}`,
            data: circleData,
            pickable: true, // enable interaction with the pin circles
            getPosition: (d: any) => d.position,
            radiusUnits: 'pixels',
            getRadius: (d: any) =>
                hoveredExemplar.value === d.exemplar || selectedExemplar.value === d.exemplar
                    ? viewConfiguration.value.hoveredLineWidth * 2
                    : 3,
            getFillColor: (d: HistogramPin) =>
                getExemplarColor(
                        d.exemplar,
                        selectedExemplar.value,
                        hoveredExemplar.value,
                        d.color,
                        fillColor
                    ),
            // When a pin is clicked, dragged or released, we log a dummy event.
            onDragStart: (info: PickingInfo, event: any) =>
                handlePinDragStart(info, event, conditionGroupKey),
            onDrag: (info: PickingInfo, event: any) =>
                handlePinDrag(info, event, conditionGroupKey),
            onDragEnd: (info: PickingInfo, event: any) =>
                handlePinDragEnd(info, event, conditionGroupKey),
        })
    );
    // Return the lines and circles that comprise pin layers.
    return pinLayers;
}

function handlePinDragStart(
    info: PickingInfo,
    event: any,
    conditionGroupKey: ExemplarTrack
) {
    dragPin.value = info.object;
}

function handlePinDrag(
    info: PickingInfo,
    event: any,
    conditionGroupKey: ExemplarTrack
) {
    if (!info.coordinate) return;
    const hoveredY = info.coordinate[1];
    const { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
    const fixedLineLength = histWidth;
    const x0 = hGap;
    const index = pinnedPins.value.findIndex((p) => p.id === info.object.id);
    if (index >= 0) {
        pinnedPins.value[index] = {
            ...pinnedPins.value[index],
            source: [-x0, hoveredY],
            target: [-(x0 + fixedLineLength), hoveredY],
        };
        updatePinsLayer(conditionGroupKey);
    }
}

function handlePinDragEnd(
    info: PickingInfo,
    event: any,
    conditionGroupKey: ExemplarTrack
) {
    dragPin.value = null;
    updatePinsLayer(conditionGroupKey);
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

    safeRenderDeckGL();
  }
  else if (action === 'click') {
    // see if this exact cell is already selected
    const selIdx = selectedCellsInfo.value.findIndex(
      ([, c]) => c.frame === cell.frame && exemplar.trackId === exemplar.trackId
    );
    if (selIdx >= 0) {
      // Deselect: remove all from parallel arrays
      selectedCellsInfo.value.splice(selIdx, 1);
      selectedCellImageLayers.value.splice(selIdx, 1);
      snippetSegmentationOutlineLayers.value.splice(selIdx, 1);
      selectedCellImageTickMarkLayers.value.splice(selIdx, 1);
      // clear store selection if nothing left
      if (selectedCellsInfo.value.length === 0) {
        selectedExemplar.value = null;
        dataPointSelection.selectedTrackId = null;
        dataPointSelection.setCurrentFrameIndex(0);
      }
    } else {
      // original selection logic
      selectedExemplar.value = exemplar;
      selectedCellsInfo.value.push([eventCellBBox, cell]);
      if (cellImageLayerResult.cellImageLayer) {
        selectedCellImageLayers.value.push(cellImageLayerResult.cellImageLayer);
      }
      if (cellImageLayerResult.segmentationLayer) {
        snippetSegmentationOutlineLayers.value.push(
          cellImageLayerResult.segmentationLayer.snippetSegmentationOutlineLayer!
        );
      }
      if (cellImageLayerResult.tickMarkLayer) {
        selectedCellImageTickMarkLayers.value.push(
          cellImageLayerResult.tickMarkLayer
        );
      }
      dataPointSelection.selectedTrackId = exemplar.trackId;
      dataPointSelection.setCurrentFrameIndex(realTimePoint);
    }
    safeRenderDeckGL();
  }
  return cellImageLayerResult;
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
): FinalCellImageLayer  | null {
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
  
  // Get the BBox coordinates for the cell.
  const imageSnippetDestination = computeDestination(cell, exemplar, destY);
  
  // Extract the source bounding box around the cell's coordinates.
  const source = getBBoxAroundPoint(
    cell.x ?? 0,
    cell.y ?? 0,
    viewConfig.snippetSourceSize,
    viewConfig.snippetSourceSize
  );
  
  // Create a snippet selection entry.
  selections.push({
    c: 0,
    t: cell.frame - 1,
    z: 0,
    snippets: [{ source, destination: imageSnippetDestination }],
  });
  
  // Create and return a new CellSnippetsLayer with the computed settings.
  const cellImageLayer = new CellSnippetsLayer({
    loader: pixelSource,
    id: `cell-image-event-layer-${cell.frame}-${exemplar.trackId}`,
    contrastLimits: contrastLimits,
    selections: selections,
    channelsVisible: [true],
    extensions: [colormapExtension],
    colormap: imageViewerStore.colormap,
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

  const combinedSnippetSegmentationLayer: combinedSnippetSegmentationLayer = { snippetSegmentationOutlineLayer: null, snippetSegmentationLayer: null };

  // Determine if this is a selected cell (when clicking) vs hovered cell
  const isSelectedCell = selectedExemplar.value?.trackId === exemplar.trackId;
  // Create a new segmentation outline layer for these cells.
  combinedSnippetSegmentationLayer.snippetSegmentationOutlineLayer = new SnippetSegmentationOutlineLayer({
        id: `hovered-snippet-segmentation-outline-layer-${exemplar.trackId}-${cell.frame}`,
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
        scale: snippetZoom,
        clipSize: viewConfig.snippetDisplayHeight,
        clip: true,
    });
    const unselectedColorWithAlpha = colors.unselectedBoundary.rgba;
  const selectedColorWithAlpha = globalSettings.normalizedSelectedRgba;
  combinedSnippetSegmentationLayer.snippetSegmentationLayer =
        new SnippetSegmentationLayer({
            id:'cell-boundary-layer-'+ exemplar.trackId + '-' + Date.now(),
            data: imageSegmentationData,
            getPolygon: (d: any) => d.polygon,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            getFillColor: (d: any) => colors.hovered.rgb,
            opacity: 0.5,
            zoomX: viewStateMirror.value.zoom[0],
            scale: snippetZoom,
            clipSize: viewConfig.snippetDisplayHeight,
            clip: false,
            filled: true, // Only fill if not showing image
        });
  
  // The tick should be placed at the center of the snippet.
  const [x1, y1, , ]= imageSnippetDestination;
  const tickX = x1 + snippetDestWidth / 2;
  const tickY = y1
  const tickLength = viewConfiguration.value.horizonChartHeight + viewConfiguration.value.snippetHorizonChartGap*2;
  const tickData = {
    path: [
      [tickX, tickY],
      [tickX, tickY + tickLength]
    ],
    hovered: !isSelectedCell,
    selected: isSelectedCell,
  };

  const hoveredImageOutlineLayer = new PolygonLayer({
    id: `hovered-cell-image-outline-${cell.frame}-${exemplar.trackId}`,
    data: [{ polygon: [
      [imageSnippetDestination[0], imageSnippetDestination[1]],
      [imageSnippetDestination[2], imageSnippetDestination[1]], 
      [imageSnippetDestination[2], imageSnippetDestination[3]],
      [imageSnippetDestination[0], imageSnippetDestination[3]],
      [imageSnippetDestination[0], imageSnippetDestination[1]]
    ] }],
    pickable: false,
    stroked: true,
    filled: false,
    getPolygon: d => d.polygon,
    getLineColor: colors.hovered.rgb, // Same color as other hovered elements
    getLineWidth: viewConfiguration.value.hoveredLineWidth, // Same width as other hovered elements
    lineWidthUnits: 'pixels'
  });
    // Create the tick mark layer using the tick data.
    // Use the modified createTickMarkLayer function to ensure unique IDs.
  const cellImageTickMarkLayer = createTickMarkLayer([tickData]);

    return { 
        tickMarkLayer: cellImageTickMarkLayer, 
        cellImageLayer, 
        segmentationLayer: combinedSnippetSegmentationLayer,
        imageOutlineLayer: hoveredImageOutlineLayer // Add this new layer
    };
}

// Add this near the top of your <script setup> block:
let tickMarkLayerCounter = 0;

// … later, replace your existing createTickMarkLayer with:

function createTickMarkLayer(rawData: any): LineLayer {
  // ensure we always hand deck.gl an array
  const data = Array.isArray(rawData) ? rawData : [rawData];

  return new LineLayer({
    // use an ever‐incrementing counter instead of Date.now()
    id: `snippet-tick-marks-layer-${tickMarkLayerCounter++}`,
    data,
    pickable: false,
    getSourcePosition: (d: any) => d.path[0],
    getTargetPosition: (d: any) => d.path[1],
    getColor: (d: any) => {
      if (d.pinned || d.selected) {
        return globalSettings.normalizedSelectedRgb;
      } else if (d.hovered || d.drawerLine) {
        return colors.hovered.rgb; // Use the same hovered color as other elements
      }
      return [130, 145, 170, 150];
    },
    getWidth: (d: any) => (d.hovered || d.pinned || d.selected ? viewConfiguration.value.hoveredLineWidth : 1.5),
    widthUnits: 'pixels',
    rounded: false, // deck.gl uses `rounded`, not `capRounded`
  });
}

function constructGeometry(track: ExemplarTrack): number[] {
    return constructGeometryBase(track.data, cellMetaData.timestep);
}

function createExemplarImageKeyFrameLayers():
  (CellSnippetsLayer |
   SnippetSegmentationOutlineLayer |
   SnippetSegmentationLayer |
   LineLayer)[] {
  const layers: Array<
    CellSnippetsLayer |
    SnippetSegmentationOutlineLayer |
    SnippetSegmentationLayer |
    LineLayer
  > = [];
  if (!pixelSources.value) return layers;
  const urls = exemplarViewStore.getExemplarImageUrls();
  for (const exemplar of exemplarTracksOnScreen.value) {
    const src = pixelSources.value![exemplar.locationId];
    if (!src) {
      const url = urls.get(exemplar.locationId);
      if (url) loadPixelSource(exemplar.locationId, url);
      continue;
    }
    const result = createExemplarImageKeyFramesLayer(src, exemplar);
    if (!result) continue;
    // 1) back: filled segmentation
    if (
      viewConfiguration.value.showSnippetOutline &&
      result.segmentationLayer?.snippetSegmentationLayer
    ) {
      layers.push(result.segmentationLayer.snippetSegmentationLayer);
    }
    // 2) then the image
    if (viewConfiguration.value.showSnippetImage && result.cellImageLayer) {
      layers.push(result.cellImageLayer);
    }
    // 3) then the outline
    if (
      viewConfiguration.value.showSnippetOutline &&
      result.segmentationLayer?.snippetSegmentationOutlineLayer
    ) {
      layers.push(result.segmentationLayer.snippetSegmentationOutlineLayer);
    }
    // 4) front: tick marks
    if (result.tickMarkLayer) {
      layers.push(result.tickMarkLayer);
    }
  }
  return layers;
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
    if (!viewConfiguration.value.spaceKeyFramesEvenly) {
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


// --- Helper Function
// Calculate the destination bbox for a given cell.
function computeDestination(cell: Cell, exemplar: ExemplarTrack, destY: number): BBox {
    const duration = exemplar.maxTime - exemplar.minTime;
    const pct =
        duration > 0
        ? (cell.time - exemplar.minTime) / duration
        : 0.5;
    const viewConfig = viewConfiguration.value;
    const cx = viewConfig.horizonChartWidth * pct;
    const snippetDestWidth = scaleForConstantVisualSize(viewConfig.snippetDisplayWidth);
    const snippetDestHeight = viewConfig.snippetDisplayHeight;
    const x1 = cx - snippetDestWidth / 2;
    const x2 = x1 + snippetDestWidth;
    const y1 = destY;
    const y2 = y1 - snippetDestHeight;
    return [x1, y1, x2, y2];
}

// TODO: this is reusing the same cache across multiple layers which technically could have a clash if there is an identical snippet across different layers.
// Updated createExemplarImageKeyFramesLayer() with enhanced debugging:
let hoveredCoordinate = <[number, number] | null>null;
function createExemplarImageKeyFramesLayer(
  pixelSource: PixelSource<any>,
  exemplar: ExemplarTrack
): FinalCellImageLayer | null {
  // --- Validation and basic setup ---
  if (!pixelSource) {
    console.error('[createExemplarImageKeyFramesLayer] pixelSource is not set!');
    return { cellImageLayer: null, segmentationLayer: null, tickMarkLayer: null };
  }
  if (!exemplarTracks.value || exemplarTracks.value.length === 0) {
    console.error('[createExemplarImageKeyFramesLayer] No exemplar tracks available!');
    return { cellImageLayer: null, segmentationLayer: null, tickMarkLayer: null };
  }

  const viewConfig = viewConfiguration.value;
  const snippetDestWidth = scaleForConstantVisualSize(viewConfig.snippetDisplayWidth);
  const snippetDestHeight = viewConfig.snippetDisplayHeight;

  // Calculate destination Y from the yOffset of the current exemplar.
  let destY = viewConfig.horizonChartHeight; // fallback
  
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
  
  // Add segmentation data given a cell, its destination, and whether it is "selected" (or hovered).
  function addSegmentation(frame: number, dest: [number, number, number, number], hovered: boolean, cell: Cell) {
    if (frame <= 0) return;
    const segmentationPolygon = getCellSegmentationPolygon(
      exemplar.locationId,
      exemplar.trackId.toString(),
      frame.toString()
    );
    if (!segmentationPolygon) return;
    const [destX, destY] = [dest[0], dest[1]];


  const cellSelected = selectedCellsInfo.value.some(
    ([, selectedCell]) => selectedCell.frame === cell.frame && selectedCell.time === cell.time
  );
    exemplarSegmentationData.push({
      // @ts-ignore: coordinates exist on geometry
      polygon: segmentationPolygon.geometry.coordinates,
      hovered: hovered,
      selected: cellSelected,
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
  const margin = 5; // margin for side-by-side positioning
  const keyFrames = getKeyFrameOrder(exemplar);
  for (const { index, nearestDistance } of keyFrames) {
    const cell = exemplar.data[index];
    const nearestDistanceWidth = convertDurationToWidth(nearestDistance);
    if (nearestDistanceWidth <= snippetDestWidth + 4) break;
    const destination = computeDestination(cell, exemplar, destY);

    // Check if the hovered pointer falls within this destination.
    if (pointInBBox(hoveredCoordinate ?? [-1000, 0], destination)) {

      // Find the previous and next cells in the exemplar data
      const currentIndex = exemplar.data.findIndex(c => c.frame === cell.frame);
      const prevCell = currentIndex > 0 ? exemplar.data[currentIndex - 1] : null;
      const nextCell = currentIndex < exemplar.data.length - 1 ? exemplar.data[currentIndex + 1] : null;

      // Calculate correct timeline positions for prev and next cells
      const prevCellTimelineDest: [number, number, number, number] = prevCell 
        ? computeDestination(prevCell, exemplar, destY)
        : destination; // fallback to current if no prev cell
      
      const nextCellTimelineDest: [number, number, number, number] = nextCell 
        ? computeDestination(nextCell, exemplar, destY)
        : destination; // fallback to current if no next cell

      // Check for overlaps with the hovered cell destination
      const prevOverlaps = prevCell && rectsOverlap(destination, prevCellTimelineDest);
      const nextOverlaps = nextCell && rectsOverlap(destination, nextCellTimelineDest);

      // Calculate display positions (may be different from timeline positions)
      let prevCellDisplayDest = prevCellTimelineDest;
      let nextCellDisplayDest = nextCellTimelineDest;

      // If overlapping, position to the left/right of the hovered cell
      if (prevOverlaps) {
        const [hoveredX1, hoveredY1, hoveredX2, hoveredY2] = destination;
        prevCellDisplayDest = [
          hoveredX1 - snippetDestWidth - margin, // left of hovered cell
          hoveredY1,
          hoveredX1 - margin,
          hoveredY2
        ];
      }

      if (nextOverlaps) {
        const [hoveredX1, hoveredY1, hoveredX2, hoveredY2] = destination;
        nextCellDisplayDest = [
          hoveredX2 + margin, // right of hovered cell
          hoveredY1,
          hoveredX2 + margin + snippetDestWidth,
          hoveredY2
        ];
      }

      hoveredFound.value = true;
      hoveredImagesInfo.value = [
        [prevCellDisplayDest, prevCell || cell],
        [nextCellDisplayDest, nextCell || cell],
        [destination, cell]
      ];

      // Push selections for previous, current and next locations using display positions
      const selections_to_add = [];
        
      if (prevCell) {
        selections_to_add.push({ 
          c: 0, 
          t: prevCell.frame - 1, 
          z: 0, 
          snippets: [{ 
            source: getBBoxAroundPoint(prevCell.x, prevCell.y, viewConfig.snippetSourceSize, viewConfig.snippetSourceSize), 
            destination: prevCellDisplayDest // use display position
          }] 
        });
      }
        
      selections_to_add.push({ 
        c: 0, 
        t: cell.frame - 1, 
        z: 0, 
        snippets: [{ 
          source: getBBoxAroundPoint(cell.x, cell.y, viewConfig.snippetSourceSize, viewConfig.snippetSourceSize), 
          destination: destination 
        }] 
      });
        
      if (nextCell) {
        selections_to_add.push({ 
          c: 0, 
          t: nextCell.frame - 1, 
          z: 0, 
          snippets: [{ 
            source: getBBoxAroundPoint(nextCell.x, nextCell.y, viewConfig.snippetSourceSize, viewConfig.snippetSourceSize), 
            destination: nextCellDisplayDest // use display position
          }] 
        });
      }
        
      selections.push(...selections_to_add);

      // Add segmentation using display positions
      addSegmentation(cell.frame, destination, true, cell);
      if (prevCell) {
        addSegmentation(prevCell.frame, prevCellDisplayDest, true, prevCell);
      }
      if (nextCell) {
        addSegmentation(nextCell.frame, nextCellDisplayDest, true, nextCell);
      }

        // Add tick marks ------------------------------------------------
        const [x1, y1] = destination;
        const tickLength = viewConfig.horizonChartHeight + viewConfig.snippetHorizonChartGap * 2;
        const beforeAfterMarginY = 4;

        // Helper function to create a tick mark
        const createTick = (cell: Cell, timelineDest: [number, number, number, number], isMain: boolean = false) => {
        const [tickDestX1] = timelineDest;
        const tickX = tickDestX1 + snippetDestWidth / 2;
        const tickY = isMain ? y1 : y1 + beforeAfterMarginY;
        
        return {
            path: [
            [tickX, tickY],
            [tickX, tickY + tickLength]
            ],
            hovered: true,
            selected: cell.isSelected,
        };
        };

        // Create ticks for all cells (prev, current, next)
        tickData.push(createTick(cell, destination, true)); // Main cell tick
        if (prevCell) {
        tickData.push(createTick(prevCell, prevCellTimelineDest));
        }
        if (nextCell) {
        tickData.push(createTick(nextCell, nextCellTimelineDest));
        }

        // Add horizontal span line connecting all visible images (1, 2, or 3) --------
        const visibleCells = [];
        if (prevCell) visibleCells.push({ cell: prevCell, dest: prevCellDisplayDest });
        visibleCells.push({ cell: cell, dest: destination });
        if (nextCell) visibleCells.push({ cell: nextCell, dest: nextCellDisplayDest });

        if (visibleCells.length >= 1) {
        // Calculate the outer bounding box of all visible images
        const allDisplayDests = visibleCells.map(c => c.dest);
        
        // Find the leftmost and rightmost X coordinates of the images
        const leftmostX = Math.min(...allDisplayDests.map(dest => dest[0]));
        const rightmostX = Math.max(...allDisplayDests.map(dest => dest[2]));
        
        // Position the line at the bottom edge of the images
        const spanLineY = Math.min(...allDisplayDests.map(dest => dest[1]));
        
        const bracketLeft = leftmostX - beforeAfterMarginY;
        const bracketRight = rightmostX + beforeAfterMarginY;
        const bracketLineY = spanLineY + 3; // Slight offset below images
        
        // Create the bracket shape: left cap, horizontal line, right cap
        const bracketHeight = 6;
        const lineThickness = 1.5;
        
        // Helper function to create bracket components
        const createBracketLine = (startPos: [number, number], endPos: [number, number]) => ({
            path: [startPos, endPos],
            hovered: true,
            selected: false,
        });
        
        // Add all bracket components
        tickData.push(
            // Main horizontal line
            createBracketLine([bracketLeft, bracketLineY], [bracketRight, bracketLineY]),
            // Left vertical cap
            createBracketLine([bracketLeft, bracketLineY + lineThickness], [bracketLeft, bracketLineY - bracketHeight + lineThickness]),
            // Right vertical cap
            createBracketLine([bracketRight, bracketLineY + lineThickness], [bracketRight, bracketLineY - bracketHeight + lineThickness])
        );
        }
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
    const destination = computeDestination(cell, exemplar, destY);

    // Check for collisions.
    const cellCollisionDetected = interactedCellBBoxes.some(bbox => rectsOverlap(destination, bbox));
    if (!cellCollisionDetected) {
      // Normal keyframe selection and segmentation.
      selections.push({
        c: 0,
        t: cell.frame - 1,
        z: 0,
        snippets: [{
          source: getBBoxAroundPoint(cell.x, cell.y, viewConfig.snippetSourceSize, viewConfig.snippetSourceSize),
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
        hovered: false,
        selected: false,
      });
    }
  }

  if (!hoveredFound.value) {
    hoveredImagesInfo.value = [];
  }

  let cellSnippetsLayerCount = ref(0);
  // --- Create layer instances using the computed data ---
  const snippetLayer = new CellSnippetsLayer({
    id: `cell-snippets-layer-${exemplar.trackId}-${cellSnippetsLayerCount.value++}`,
    loader: pixelSource,
    onHover: (info: PickingInfo) => {
      if (info.coordinate && info.coordinate.length === 2) {
        hoveredCoordinate = [info.coordinate[0], info.coordinate[1]];
        
        // Set the hovered exemplar to trigger proper styling
        if (info.object || info.index !== -1) {
          hoveredExemplar.value = exemplar;
          createHoveredHorizonOutlineLayer();
        } else {
          // Clear hover state when not hovering over anything
          hoveredExemplar.value = null;
          hoveredOutlineLayer.value = null;
          horizonTextLayer.value = null;
        }
      } else {
        // Clear hover state when coordinate is invalid
        hoveredCoordinate = null;
        hoveredExemplar.value = null;
        hoveredOutlineLayer.value = null;
        horizonTextLayer.value = null;
      }
      safeRenderDeckGL();
    },
    contrastLimits,
    channelsVisible: [true],
    selections: selections,
    extensions: [colormapExtension],
    colormap: imageViewerStore.colormap,
    cache: lruCache,
  });

  const hoveredWithAlpha = colors.hovered.rgba;
  hoveredWithAlpha[3] = 200;

  // Segmentation Layer Instantiation -------------------------------------------------
  const combinedSnippetSegmentationLayer: combinedSnippetSegmentationLayer = { snippetSegmentationOutlineLayer: null, snippetSegmentationLayer: null };

  // Cell Segmentation Outline within boundaries (non-hovered)
  combinedSnippetSegmentationLayer.snippetSegmentationOutlineLayer = new SnippetSegmentationOutlineLayer({
    id: `snippet-segmentation-outline-key-frame-layer-${exemplar.trackId}-${Date.now()}`,
    data: exemplarSegmentationData,
    getPath: (d: any) => d.polygon[0],
    getColor: (d: any) => {
      if (d.selected) return globalSettings.normalizedSelectedRgb;
      if (d.hovered) return hoveredWithAlpha;
      return colors.unselectedBoundary.rgb;
    },
    getWidth: (d: any) => (d.hovered ? viewConfiguration.value.hoveredLineWidth : 1.5),
    opacity: 1,
    widthUnits: 'pixels',
    jointRounded: true,
    getCenter: (d: any) => d.center,
    getTranslateOffset: (d: any) => d.offset,
    zoomX: viewStateMirror.value.zoom[0],
    scale: snippetZoom,
    clipSize: viewConfig.snippetDisplayHeight,
    clip: true,
  });

  const unselectedColorWithAlpha = colors.unselectedBoundary.rgba;
  const selectedColorWithAlpha = globalSettings.normalizedSelectedRgba;
  // Cell segmentation out-of boundaries (non-hovered)
  combinedSnippetSegmentationLayer.snippetSegmentationLayer =
        new SnippetSegmentationLayer({
            id:'cell-boundary-layer-'+ exemplar.trackId + '-' + Date.now(),
            data: exemplarSegmentationData,
            getPolygon: (d: any) => d.polygon,
            getCenter: (d: any) => d.center,
            getTranslateOffset: (d: any) => d.offset,
            getFillColor: (d: any) => d.selected
                ? selectedColorWithAlpha
                : unselectedColorWithAlpha,
            opacity: 1, 
            zoomX: viewStateMirror.value.zoom[0],
            scale: snippetZoom,
            clipSize: viewConfig.snippetDisplayHeight,
            clip: true,
            filled: false, // Only fill if not showing image
        });

  const keyFrameTickMarkLayer = createTickMarkLayer(tickData);

  return { cellImageLayer: snippetLayer, segmentationLayer: combinedSnippetSegmentationLayer, tickMarkLayer: keyFrameTickMarkLayer };
}

// General purpose watchers ---------------------------------------------------------------------------------------------------

// Add this function to force layer recreation
function forceLayerRecreation() {
    // Clear any cached layer data
    if (deckgl.value) {
        deckgl.value.setProps({
            layers: [] // Clear all layers first
        });
        // Then re-render with new layers
        setTimeout(() => {
            if (exemplarDataInitialized.value) {
                renderDeckGL();
            }
        }, 0);
    }
}
// Add this watch to ensure layers update when selection changes
watch(
  () => selectedExemplar.value?.trackId,
  (newTrackId, oldTrackId) => {
    if (newTrackId !== oldTrackId && exemplarDataInitialized.value) {
      // Force re-render when selected exemplar changes
      safeRenderDeckGL();
    }
  }
);
// Watch the image viewer store colormap, re-render deck gl.
watch(
  () => imageViewerStore.colormap,
  (newColormap) => {
    if (exemplarDataInitialized.value && newColormap) {
      renderDeckGL();
    }
  },
  { deep: true }
);
watch(
  () => [
    horizonChartSettings.value.modHeight,
    horizonChartSettings.value.baseline,
    horizonChartSettings.value.positiveColorScheme,
    horizonChartSettings.value.negativeColorScheme
  ],
  (newValues, oldValues) => {
    if (exemplarDataInitialized.value) {
      // Check if color schemes changed (which would change array lengths)
      const colorSchemeChanged = 
        newValues[2] !== oldValues?.[2] || 
        newValues[3] !== oldValues?.[3];
      
      if (colorSchemeChanged) {
        // Force complete layer recreation for color scheme changes
        forceLayerRecreation();
      } else {
        // Normal re-render for other changes
        renderDeckGL();
      }
    }
  },
  { deep: true }
);
// Watch for changes in histogramDomains, conditionHistograms, and exemplarTracks
watch(
    () => [
        histogramDomains.value, 
        conditionHistograms.value, 
        exemplarTracks.value
    ],
    () => {
        safeRenderDeckGL();
    },
    { deep: true }
);
watch(
  () => exemplarDataInitialized.value,
  (initialized) => {
    if (initialized) {
      renderDeckGL();
    }
  }
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
watch(
  () => exemplarViewStore.viewConfiguration.spaceKeyFramesEvenly,
  () => {
    // Invalidate keyframe order cache when spacing mode changes
    if (keyframeOrderLookup.value) keyframeOrderLookup.value.clear();
    if (exemplarDataInitialized.value) {
      renderDeckGL();
    }
  }
);
watch(
  () => exemplarViewStore.viewConfiguration,
  () => {
    if (exemplarDataInitialized.value) {
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
        safeRenderDeckGL();
    }
);
watch(
  () => exemplarViewStore.viewConfiguration.margin,
  (newMargin, oldMargin) => {
    if (exemplarDataInitialized.value && newMargin !== oldMargin) {
      // Margin affects scroll extent and view positioning
      const newScrollExtent = scrollExtent.value;
      let targetY = clamp(
        viewStateMirror.value.target[1],
        newScrollExtent.min,
        newScrollExtent.max
      );
      
      // Recalculate zoomX since margin affects visualization width
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
      
      if (deckgl.value) {
        deckgl.value.setProps({
          initialViewState: newViewState,
        });
      }
      
      renderDeckGL();
    }
  },
  { immediate: false }
);
// Watch for user modifications to bin size and baseline
watch(() => horizonChartSettings.value.modHeight, () => {
    horizonChartSettings.value.userModifiedNumeric = true;
});

watch(() => horizonChartSettings.value.baseline, () => {
    horizonChartSettings.value.userModifiedNumeric = true;
});

// Watch for user modifications to color schemes
watch(() => horizonChartSettings.value.positiveColorScheme, () => {
    horizonChartSettings.value.userModifiedColors = true;
}, { deep: true });

watch(() => horizonChartSettings.value.negativeColorScheme, () => {
    horizonChartSettings.value.userModifiedColors = true;
}, { deep: true });

// Finds the fill color for the exemplar track based on the selected Y tag.
const fillColor = (exemplar: ExemplarTrack | undefined) => {
    if (
        !exemplar ||
        !exemplar.tags ||
        !exemplar.tags.conditionTwo ||
        !exemplar.tags.conditionOne
    ) {
        console.warn('Failing validation check with:', {
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
    return exemplarDataLoaded.value && exemplarDataInitialized.value;
});
</script>

<template>
    <div v-if="!isExemplarViewReady && currentLocationMetadata" class="spinner-container">
        <q-spinner color="primary" size="3em" :thickness="10" />
        <div>
            {{
                `Loading ${histogramYAxisLabel}`
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
