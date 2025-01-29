<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { PickingInfo, MjolnirEvent } from '@deck.gl/core';
import { Deck, OrthographicView } from '@deck.gl/core';
import { Layer } from '@deck.gl/core';
import {
    ScatterplotLayer,
    PolygonLayer,
    LineLayer,
    TextLayer,
} from '@deck.gl/layers';
import {
    type DataPoint,
    type ExemplarTrack,
    useExemplarViewStore,
    type HistogramDomains,
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
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

const deckGlContainer = ref<HTMLCanvasElement | null>(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

const exemplarViewStore = useExemplarViewStore();
const cellMetaData = useCellMetaData();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized } = storeToRefs(datasetSelectionStore);

const {
    viewConfiguration,
    exemplarTracks,
    exemplarHeight,
    conditionGroupHeight,
    conditionHistograms,
    histogramDomains,
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
const { selectedYTag, currentExperimentTags } = storeToRefs(conditionSelector);

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

            await exemplarViewStore.getExemplarTracks();
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
                });
                console.log('Deck.gl initialized.');
            }
            // Generates the test exemplar tracks
            // await exemplarViewStore.generateTestExemplarTracks();

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

// Function to render Deck.gl layers
function renderDeckGL(): void {
    if (!deckgl.value) return;

    recalculateExemplarYOffsets();

    const layers = [];

    layers.push(createSidewaysHistogramLayer());
    layers.push(createHorizonChartLayer());
    layers.push(createImageSnippetLayer());
    layers.push(createSnippetBoundaryLayer());
    layers.push(createTimeWindowLayer());
    layers.push(createPinsAndLinesLayer());

    deckgl.value.setProps({
        layers,
        controller: true,
    });
}

// Define the static list of colors (you can customize these)
// Start of Selection
const DRUG_COLORS = [
    hexListToRgba(['#C026D3']), // Fuchsia 600
    hexListToRgba(['#0D9488']), // Teal 600
    hexListToRgba(['#2563EB']), // Blue 600
    hexListToRgba(['#65A30D']), // Lime 600
    hexListToRgba(['#0EA5E9']), // Sky 500
    hexListToRgba(['#E11D48']), // Rose 600
];

// Compute unique drugs and assign colors
const uniqueDrugs = computed(() => {
    const drugs = new Set<string>();
    exemplarTracks.value.forEach((exemplar) => {
        drugs.add(exemplar.tags.drug);
    });
    return Array.from(drugs);
});

// Create a computed mapping from drug names to colors
const drugColorMap = computed<Record<string, number[]>>(() => {
    const map: Record<string, number[]> = {};
    uniqueDrugs.value.forEach((drug, index) => {
        map[drug] = DRUG_COLORS[index % DRUG_COLORS.length].map(
            (component) => component * 255
        );
    });
    return map;
});

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
    '#333333', // Grey 8
    '#1a1a1a', // Grey 9
    '#000000', // Black
];
function handleHorizonHoverLogic(info: PickingInfo, exemplar: ExemplarTrack) {
    if (info.index !== -1) {
        // pointer is over the layer
        hoveredExemplarKey.value = uniqueExemplarKey(exemplar);
        console.log(
            'Hovered horizon chart for exemplar:',
            hoveredExemplarKey.value
        );
    } else {
        // pointer left the layer
        hoveredExemplarKey.value = null;
        console.log('No horizon chart hovered');
    }
}
function createHorizonChartLayer(): HorizonChartLayer[] | null {
    const horizonChartLayers: HorizonChartLayer[] = [];

    for (const exemplar of exemplarViewStore.exemplarTracks) {
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
                onHover: (info: PickingInfo) =>
                    handleHorizonHover(info, exemplar),
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

function handleHorizonHover(info: PickingInfo, exemplar: ExemplarTrack) {
    if (info.index !== -1) {
        // we hovered the horizon chart
        hoveredExemplarKey.value = uniqueExemplarKey(exemplar);
        console.log('Hovered HorizonChart Exemplar:', hoveredExemplarKey.value);
    } else {
        // pointer left the horizon chart
        hoveredExemplarKey.value = null;
        console.log('No HorizonChart hovered');
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
            id: `exemplar-snippet-placeholder`,
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
    console.log('Total Experiment Time:', totalExperimentTime.value);
    // Total Experiment Time - 1/4 of the time bar height
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-snippet-background-placeholder`,
            data: exemplarTracks.value,
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
        })
    );

    // Exemplar time window - Black bar on top of the total experiment time
    placeholderLayer.push(
        new PolygonLayer({
            id: `exemplar-time-window`,
            data: exemplarTracks.value,
            getPolygon: (exemplar: ExemplarTrack) => {
                const yOffset = exemplarYOffsets.value.get(
                    uniqueExemplarKey(exemplar)
                )!;
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

            getFillColor: (exemplar: ExemplarTrack) =>
                drugColorMap.value[exemplar.tags.drug],

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

        const fillColor = drugColorMap.value[drug] || [128, 128, 128];
        const isHovered =
            hoveredExemplarKey.value === uniqueExemplarKey(firstExemplar);

        // default circle is 3, so double is 6
        const circleRadius = isHovered ? 6 : 3;

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
                getColor: fillColor,
                // Start of Selection
                lineWidthUnits: 'common',
                lineWidth: 7, // Adjust thickness as needed
            })
        );

        // Draw the "filled" sideways histogram bins
        const histogramPolygons = histogramDataForGroup.map((count, index) => {
            const y0 = groupTop + index * binWidth;
            const y1 = y0 + binWidth;
            const x0 = hGap + 0.25 * histWidth;
            const x1 = x0 + (count / domains.maxY) * (histWidth * 0.75);

            return [
                [-x0, y0],
                [-x1, y0],
                [-x1, y1],
                [-x0, y1],
                [-x0, y0],
            ];
        });

        layers.push(
            new PolygonLayer({
                id: `sideways-histogram-layer-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: histogramPolygons,
                pickable: false,
                stroked: false,
                filled: true,
                extruded: false,
                getPolygon: (d: any) => d,
                getFillColor: [153, 153, 153],
                getElevation: 0,
            })
        );

        //
        // ADD HORIZONTAL "TICK" LINES AND VERTICAL CONNECTOR LINES FOR EACH EXEMPLAR
        //
        // 1. Compute average mass.
        // 2. Find which bin it falls into.
        // 3. Compute y-mid of that bin & x-range of that bin's polygon.
        // 4. Store line data for LineLayer.
        // 5. Add a vertical line connecting to the horizon chart.
        //
        const lineData: {
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
            lineData.push({
                source: [-x0, yMid],
                target: [-(x0 + fixedLineLength), yMid],
                exemplar,
            });

            // Draw vertical connector line from end of horizontal line to horizon chart
            lineData.push({
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

        // Push a new LineLayer to draw these lines with thinner stroke
        layers.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-lines-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: lineData,
                pickable: false,
                getSourcePosition: (d: any) => d.source,
                getTargetPosition: (d: any) => d.target,
                getColor: fillColor, // Black lines
                getWidth: (d: {
                    source: [number, number];
                    target: [number, number];
                    exemplar: ExemplarTrack;
                }) =>
                    hoveredExemplarKey.value === uniqueExemplarKey(d.exemplar)
                        ? 4
                        : 1, // Thinner stroke width
                opacity: 0.03,
            })
        );

        // Push a ScatterplotLayer to draw tiny circles at the left end of the horizontal lines
        layers.push(
            new ScatterplotLayer({
                id: `exemplar-sideways-histogram-circles-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: circlePositions,
                pickable: true, // Important: enabling picking
                getPosition: (d) => d.position,
                // Updated to dynamically adjust radius based on hover state and added type annotation
                getRadius: (d: {
                    position: [number, number];
                    exemplar: ExemplarTrack;
                }) =>
                    hoveredExemplarKey.value === uniqueExemplarKey(d.exemplar)
                        ? 6
                        : 3,
                getFillColor: fillColor,
                // Removed fixed radius constraints to allow dynamic sizing
                // radiusMinPixels: 2,
                // radiusMaxPixels: 4,
                onHover: handleHover,
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
                getColor: fillColor,
                billboard: true,
                textAnchor: 'middle',
                alignmentBaseline: 'middle',
            })
        );
    }

    return layers;
}

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

function createPinsAndLinesLayer(): null {
    // TODO: implement
    return null;
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
