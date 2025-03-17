<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView } from '@deck.gl/core';
import { getChannelStats, loadOmeTiff } from '@hms-dbmi/viv';
import type { PixelData } from '@vivjs/types';
import {
    ScatterplotLayer,
    PolygonLayer,
    LineLayer,
    TextLayer,
} from '@deck.gl/layers';
import { QSpinner } from 'quasar';
import {
    type ExemplarTrack,
    useExemplarViewStore,
} from '@/stores/componentStores/ExemplarViewStore';
import { getBBoxAroundPoint } from '@/util/imageSnippets';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { storeToRefs } from 'pinia';
import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';
import CellSnippetsLayer from '../layers/CellSnippetsLayer';
import {
    constructGeometryBase,
    hexListToRgba,
    HORIZON_CHART_MOD_OFFSETS,
} from './deckglUtil';
import { isEqual } from 'lodash';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useConfigStore } from '@/stores/misc/configStore';
import Pool from '@/util/Pool';
import { LRUCache } from 'lru-cache';
import { AdditiveColormapExtension } from '@hms-dbmi/viv';
import { type PickingInfo } from '@deck.gl/core/typed';
import { useDataPointSelectionUntrracked } from '@/stores/interactionStores/dataPointSelectionUntrrackedStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { format } from 'd3-format';

const configStore = useConfigStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const imageViewerStore = useImageViewerStore();
const { contrastLimitSlider } = storeToRefs(imageViewerStoreUntrracked);

const deckGlContainer = ref<HTMLCanvasElement | null>(null);

const exemplarViewStore = useExemplarViewStore();
const conditionSelectorStore = useConditionSelectorStore();

const cellMetaData = useCellMetaData();
const dataPointSelectionUntrracked = useDataPointSelectionUntrracked();
const { hoveredCellIndex } = storeToRefs(dataPointSelectionUntrracked);
const looneageViewStore = useLooneageViewStore();

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

// 1. Add a reactive reference for the hovered exemplar
const hoveredExemplarKey = ref<string | null>(null);

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
                    initialViewState: {
                        zoom: 0,
                        target: [0, 0],
                        minZoom: -8,
                        maxZoom: 8,
                    },
                    pickingRadius: 5,
                    canvas: deckGlContainer.value,
                    views: new OrthographicView({
                        id: 'exemplarController',
                        controller: true,
                    }),
                    controller: true,
                    layers: [],
                    getTooltip: (info: {
                        object: any;
                        x: number;
                        layer?: any;
                    }) => {
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
                            const timeFormatter = format('.2f');
                            const valueFormatter = format('.3f');
                            // Create the tooltip HTML, with the currently hovered exemplar and time.
                            let html = `<h5>Cell: ${hoveredExemplar.value?.trackId}</h5>`;
                            html += `<div>Time: ${timeFormatter(time)}</div>`;
                            html += `<div>${selectedAttribute.value}: ${
                                hoveredValue.value !== null
                                    ? valueFormatter(hoveredValue.value)
                                    : ''
                            }</div>`;
                            return { html };
                        }
                        return null;
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

const pixelSource = ref<any | null>(null);
const loader = ref<any | null>(null);
const testRaster = ref<PixelData | null>(null);

// Debug watch to see when currentLocationMetadata becomes available.
watch(
    currentLocationMetadata,
    (newMeta) => {
        console.log('[ExemplarView] currentLocationMetadata changed:', newMeta);
    },
    { immediate: true }
);

// Watch pixelSource so you can see when it gets set.
watch(
    pixelSource,
    (newVal) => {
        if (newVal) {
            // console.log('[ExemplarView] pixelSource loaded:', newVal);
        } else {
            console.warn('[ExemplarView] pixelSource is still null.');
        }
    },
    { immediate: true }
);

// Watches for changes in currentLocationMetadata and loads the pixel source.
watch(
    currentLocationMetadata,
    async (newMeta) => {
        if (!newMeta?.imageDataFilename) {
            console.warn(
                '[ExemplarView] currentLocationMetadata.imageDataFilename is missing. Waiting for valid metadata...'
            );
            return;
        }

        try {
            const fullImageUrl = configStore.getFileUrl(
                newMeta.imageDataFilename
            );
            loader.value = await loadOmeTiff(fullImageUrl, {
                pool: new Pool(),
            });

            // Update image dimensions from metadata
            imageViewerStoreUntrracked.sizeX =
                loader.value.metadata.Pixels.SizeX;
            imageViewerStoreUntrracked.sizeY =
                loader.value.metadata.Pixels.SizeY;
            imageViewerStoreUntrracked.sizeT =
                loader.value.metadata.Pixels.SizeT;

            testRaster.value = await loader.value.data[0].getRaster({
                selection: { c: 0, t: 0, z: 0 },
            });

            if (testRaster.value == null) {
                console.warn('[ExemplarView] testRaster is null.');
                return;
            }

            const copy = testRaster.value.data.slice();
            const channelStats = getChannelStats(copy);
            contrastLimitSlider.value.min = channelStats.contrastLimits[0];
            contrastLimitSlider.value.max = channelStats.contrastLimits[1];
            imageViewerStore.contrastLimitExtentSlider.min =
                channelStats.domain[0];
            imageViewerStore.contrastLimitExtentSlider.max =
                channelStats.domain[1];

            pixelSource.value = loader.value.data[0];

            // Optionally, trigger render after pixelSource loads:
            renderDeckGL();
        } catch (error) {
            console.error('[ExemplarView] Error loading pixel source:', error);
        }
    },
    { immediate: true }
);

// --------------------------------------------------------------------------------------------

watch(hoveredExemplarKey, () => {
    if (exemplarDataInitialized.value) {
        renderDeckGL();
    }
});

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

let deckGLLayers = [];

// Function to render Deck.gl layers
function renderDeckGL(): void {
    if (!deckgl.value) return;

    recalculateExemplarYOffsets();

    deckGLLayers = [];

    deckGLLayers.push(createSidewaysHistogramLayer());
    deckGLLayers.push(createHorizonChartLayer());
    deckGLLayers.push(createImageSnippetLayer());
    deckGLLayers.push(createSnippetBoundaryLayer());
    deckGLLayers.push(createTimeWindowLayer());
    deckGLLayers.push(createOneTestImageLayer());
    //layers.push(createDefaultImageLayerForExemplar());

    deckGLLayers = deckGLLayers.filter((layer) => layer !== null);

    deckgl.value.setProps({
        layers: deckGLLayers,
        controller: true,
    });
    deckgl.value.redraw();
}

const exemplarYOffsets = ref(new Map<string, number>());

function recalculateExemplarYOffsets(): void {
    exemplarYOffsets.value.clear();
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
        lastExemplar = exemplar;
        const key = uniqueExemplarKey(exemplar);
        exemplarYOffsets.value.set(key, yOffset);
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

    for (const exemplar of tracks) {
        // console.log(exemplar.tags);
        if (!exemplar.data || exemplar.data.length === 0) {
            continue; // Skip this exemplar if there's no data
        }

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
                pickable: true,
                onHover: (info: PickingInfo, event: any) =>
                    handleHorizonHover(info, exemplar),
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

// The currently hovered exemplar and its currently hovered value.
const hoveredExemplar = ref<ExemplarTrack | null>(null);
const hoveredValue = ref<number | null>(null);

function handleHorizonHover(info: PickingInfo, exemplar: ExemplarTrack) {
    if (info.index !== -1 && info.coordinate) {
        // Cell ID ------------------------------------------------------
        // Store the currently hovered exemplar for the tooltip.
        hoveredExemplar.value = exemplar;

        // Time ------------------------------------------------------
        // Get the x coordinate of the hover event.
        const hoverX = info.coordinate[0];
        if (!hoverX) {
            console.error('hoverX is undefined');
            return;
        }
        // Estimate the time based on the x coordinate.
        const { horizonChartWidth } = viewConfiguration.value;
        const estimatedTime = Math.max(
            0,
            exemplar.minTime +
                (exemplar.maxTime - exemplar.minTime) *
                    (hoverX / horizonChartWidth)
        );
        console.log('estimatedTime', estimatedTime);

        // Handle edge cases where the estimated time is outside the exemplar's time range.
        let realTimePoint = null;
        if (estimatedTime < exemplar.minTime) {
            realTimePoint = exemplar.minTime;
            console.log(exemplar.minTime);
        } else if (estimatedTime > exemplar.maxTime) {
            realTimePoint = exemplar.maxTime;
        }
        // Find the closest actual time in the exemplar data.
        else {
            realTimePoint = exemplar.data.reduce((prev, curr) => {
                // Only update if the estimatedTime is greater than curr.time
                // and if its distance to estimatedTime is smaller than that of the previous point.
                if (
                    estimatedTime > curr.time &&
                    Math.abs(curr.time - estimatedTime) <
                        Math.abs(prev.time - estimatedTime)
                ) {
                    return curr;
                }
                return prev;
            }, exemplar.data[0]).time;
        }
        // Update the hovered time in the store.
        dataPointSelectionUntrracked.hoveredTime = realTimePoint;

        // Set current hovered exemplar value ------------------------------------------------------
        const value = exemplar.data.find(
            (d) => d.time === realTimePoint
        )?.value;
        if (!value) {
            console.error('value is undefined');
            return;
        }
        hoveredValue.value = value;
    } else {
        hoveredExemplar.value = null;
        dataPointSelectionUntrracked.hoveredTime = null;
    }
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
            id: `exemplar-snippet-placeholder-${selectedAttribute.value}`,
            data: exemplarTracks.value,
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
            getLineColor: [225, 30, 10, 0],
            getFillColor: [225, 30, 10, 0],
            getLineWidth: 0,
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
    // console.log('Total Experiment Time:', totalExperimentTime.value);
    // Total Experiment Time - 1/4 of the time bar height
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-background-placeholder-${selectedAttribute.value}`,
            data: [...exemplarTracks.value],
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
            data: [...exemplarTracks.value],
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
                const cellBirthTime = exemplar.minTime;
                console.log('Time Window Layer');
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
    const groupedExemplars = groupExemplarsByCondition(exemplarTracks.value);

    const { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
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
        const firstOffset = exemplarYOffsets.value.get(
            uniqueExemplarKey(firstExemplar)
        )!;
        const lastOffset = exemplarYOffsets.value.get(
            uniqueExemplarKey(group[group.length - 1])
        )!;
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
                exemplarYOffsets.value.get(uniqueExemplarKey(exemplar))! -
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
                getColor: fillColor(firstExemplar), // Black lines
                getWidth: (d: {
                    source: [number, number];
                    target: [number, number];
                    exemplar: ExemplarTrack;
                }) =>
                    hoveredExemplarKey.value === uniqueExemplarKey(d.exemplar)
                        ? 4
                        : 1, // Thinner stroke width
                opacity: 0.2,
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
                sizeUnits: 'common',
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
    const { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;
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

    console.log('Bin index:', binIndex, 'Count:', count);

    // Set the temporary label: positioned 10 pixels left of the pin circle.
    tempLabel.value = {
        text: `Count: ${count}\n [${minStr}, ${maxStr}]`,
        position: [-(x0 + fixedLineLength) - 10, hoveredY],
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
        console.log('Dummy event: Pin placed at', newPin);
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

        console.log('histogramBottomY', histogramBottomY);
        console.log('histogramTopY', histogramTopY);

        // First ensure that the new exemplar tracks are loaded, then print them.
        console.log('Exemplar tracks:', exemplarTracks.value);
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
        console.log('Adding temp label', tempLabel.value);
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
                getTextAnchor: (d: any) => 'end', // 'end' aligns text to the right
                getAlignmentBaseline: (d: any) => 'center', // 'center' is the correct baseline value
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
            getColor: (d: Pin) => (d.color ? d.color : fillColor(d.exemplar)),
            getFillColor: (d: Pin) =>
                d.color ? d.color : fillColor(d.exemplar),
            // Adjust the line width based on hover state.
            getWidth: (d: any) =>
                hoveredExemplarKey.value === uniqueExemplarKey(d.exemplar)
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
            getRadius: (d: any) =>
                hoveredExemplarKey.value === uniqueExemplarKey(d.exemplar)
                    ? 6
                    : 3,
            getColor: (d: Pin) => (d.color ? d.color : fillColor(d.exemplar)),
            getFillColor: (d: Pin) =>
                d.color ? d.color : fillColor(d.exemplar),
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
    console.log('Dummy event: Pin drag started', info.object);
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
    console.log('Dummy event: Pin drag ended', info.object);
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

// Updated createOneTestImageLayer() with enhanced debugging:
function createOneTestImageLayer(): CellSnippetsLayer | null {
    // console.log(
    //     '[createOneTestImageLayer] Starting creation of one test image snippet layer...'
    // );

    // Check that the pixelSource is ready.
    if (!pixelSource.value) {
        console.error(
            '[createOneTestImageLayer] pixelSource.value is not set!'
        );
        console.warn(
            '[createOneTestImageLayer] pixelSource might not have loaded yet. Is loadOmeTiff() being called and awaited?'
        );
        return null; // Do not create the layer until pixelSource.value is available.
    } else {
        // console.log(
        //     '[createOneTestImageLayer] pixelSource is available:',
        //     pixelSource.value
        // );
    }

    // Check that exemplarTracks is available.
    if (!exemplarTracks.value || exemplarTracks.value.length === 0) {
        console.error(
            '[createOneTestImageLayer] No exemplar tracks available!'
        );
        return null;
    } else {
        // console.log(
        //     '[createOneTestImageLayer] Found exemplar tracks:',
        //     exemplarTracks.value.length
        // );
    }

    // Get viewConfiguration details for snippet placement.
    const viewConfig = viewConfiguration.value;
    const snippetWidth = viewConfig.snippetDisplayWidth;
    const snippetHeight = viewConfig.snippetDisplayHeight;
    //console.log('[createOneTestImageLayer] viewConfiguration:', viewConfig);

    // Calculate destination Y based on first exemplar yOffset.
    let destY = viewConfig.horizonChartHeight; // fallback value
    if (exemplarTracks.value && exemplarTracks.value.length > 0) {
        const firstExemplar = exemplarTracks.value[0];
        const key = uniqueExemplarKey(firstExemplar);
        const yOffset = exemplarYOffsets.value.get(key);
        if (yOffset === undefined || yOffset == null) {
            console.error(
                '[createOneTestImageLayer] No yOffset found for first exemplar with key:',
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
            // console.log(
            //     '[createOneTestImageLayer] Computed yOffset for first exemplar:',
            //     yOffset
            // );
        }
    }

    // Instead of a single snippet, create four snippet destinations with different x positions.
    const xFactors = [0.2, 0.4, 0.6, 0.8]; // relative positions along the horizonChartWidth
    const snippetDestinations: [number, number, number, number][] =
        xFactors.map((factor) => {
            const dX = viewConfig.horizonChartWidth * factor - snippetWidth / 2;
            return [dX, destY, dX + snippetWidth, destY - snippetHeight];
        });

    // Define source parameters for each snippet (currently same values for all, can be adjusted)
    const snippetParams = [
        { cellCenterX: 300, cellCenterY: 57, snippetSourceSize: 80 },
        { cellCenterX: 230, cellCenterY: 80, snippetSourceSize: 80 },
        { cellCenterX: 230, cellCenterY: 80, snippetSourceSize: 50 },
        { cellCenterX: 300, cellCenterY: 57, snippetSourceSize: 30 },
    ];

    // Create a selection with multiple snippets using individual source parameters.
    const selection = {
        c: 0, // using first channel
        t: 0, // first time
        z: 0, // first z-slice
        snippets: snippetDestinations.map((destination, idx) => ({
            source: getBBoxAroundPoint(
                snippetParams[idx].cellCenterX,
                snippetParams[idx].cellCenterY,
                snippetParams[idx].snippetSourceSize,
                snippetParams[idx].snippetSourceSize
            ),
            destination: destination,
        })),
    };
    // console.log('[createOneTestImageLayer] Selection object:', selection);

    // Create an instance of the colormap extension.
    const colormapExtension = new AdditiveColormapExtension();
    // Set up a basic LRUCache for snippet data.
    const lruCache = new LRUCache({ max: 10 });
    // Setup contrast limits and channel visibility.
    const contrastLimits = [[0, 255]];
    const channelsVisible = [true];

    // console.log(
    //     '[createOneTestImageLayer] Creating CellSnippetsLayer with the following parameters:'
    // );
    // console.log('  loader:', pixelSource.value);
    // console.log('  contrastLimits:', contrastLimits);
    // console.log('  channelsVisible:', channelsVisible);
    // console.log('  selections:', [selection]);
    // console.log('  extensions:', [colormapExtension]);
    // console.log('  colormap:', 'viridis');
    // console.log('  cache:', lruCache);

    const snippetLayer = new CellSnippetsLayer({
        id: 'test-cell-snippets-layer',
        loader: pixelSource.value, // the loaded image data
        contrastLimits,
        channelsVisible,
        selections: [selection],
        extensions: [colormapExtension],
        colormap: 'viridis',
        cache: lruCache,
    });

    // console.log(
    //     '[createOneTestImageLayer] Created CellSnippetsLayer:',
    //     snippetLayer
    // );
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

// Function to handle hover events
function handleHover(info: PickingInfo) {
    // If we hovered over a circle from our scatterplot data:
    if (info.object && (info.object as any).exemplar) {
        const pickedExemplar = (info.object as any).exemplar;
        const newHoveredKey = uniqueExemplarKey(pickedExemplar);
        hoveredExemplarKey.value = newHoveredKey;
    } else {
        hoveredExemplarKey.value = null;
    }
}

watch(loadingExemplarData, (newVal) => {
    console.log('loadingExemplarData changed:', newVal);
});

const isExemplarViewReady = computed(() => {
    return !loadingExemplarData.value && exemplarDataInitialized;
});
</script>

<template>
    <div v-show="!isExemplarViewReady" class="spinner-container">
        <!-- The loading message includes the current aggregation and attribute -->
        <q-spinner color="primary" size="3em" :thickness="10" />
        <div>
            {{
                `Loading ${exemplarViewStore.selectedAggregation.value} ${exemplarViewStore.selectedAttribute}`
            }}
        </div>
    </div>
    <div v-show="isExemplarViewReady">
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
