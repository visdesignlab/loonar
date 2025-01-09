<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core';
import type { Layer } from '@deck.gl/core';
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

const { viewConfiguration, exemplarTracks, exemplarHeight } =
    storeToRefs(exemplarViewStore);

// Reactive reference for totalExperimentTime
const totalExperimentTime = ref(0);

// Reactive Deck.gl instance
const deckgl = ref<any | null>(null);

// 1. Introduce exemplarDataInitialized
const exemplarDataInitialized = ref(false);

// Access the condition selector store
const conditionSelector = useConditionSelectorStore();
const { selectedYTag, currentExperimentTags } = storeToRefs(conditionSelector);

// Watcher to initialize Deck.gl when experimentDataInitialized becomes true
watch(
    () => experimentDataInitialized.value,
    async (initialized) => {
        if (initialized) {
            console.log('Experiment data initialized.');

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
                console.log('Deck.gl initialized.');
            }
            // Generates the test exemplar tracks
            await exemplarViewStore.generateTestExemplarTracks();

            // await exemplarViewStore.getExemplarTracks();
            console.log('Exemplar tracks generated.');

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

// Define the static list of colors (you can customize these)
const DRUG_COLORS = [
    [255, 99, 132], // Red
    [54, 162, 235], // Blue
    [255, 206, 86], // Yellow
    [75, 192, 192], // Teal
    [153, 102, 255], // Purple
    [255, 159, 64], // Orange
    // Add more colors as needed
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
        map[drug] = DRUG_COLORS[index % DRUG_COLORS.length];
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

    for (const exemplar of exemplarTracks.value) {
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
                dataXExtent: [
                    0,
                    totalExperimentTime.value > 0
                        ? totalExperimentTime.value
                        : 150,
                ],

                baseline: 0,
                binSize: 200,

                getModOffset: (d: number) => d,
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

            getFillColor: (exemplar: ExemplarTrack) =>
                drugColorMap.value[exemplar.tags.drug],
            getLineWidth: 0,
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
            getFillColor: [0, 0, 0, 255],
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

function createSidewaysHistogramLayer(): any[] | null {
    const placeholderLayer: any[] = [];

    // Group exemplars by their condition
    const groupedExemplars = groupExemplarsByCondition(exemplarTracks.value);

    const { horizonHistogramGap: hGap, histogramWidth: histWidth } =
        viewConfiguration.value;

    for (const group of groupedExemplars) {
        if (group.length === 0) continue;

        // Identify the first exemplar in the group
        const firstExemplar = group[0];

        // Determine yTag value (assuming 'drug' is the y-axis tag)
        const yTagValue = firstExemplar.tags[selectedYTag.value];
        const yIndex =
            currentExperimentTags.value[selectedYTag.value].indexOf(yTagValue);

        const drug = firstExemplar.tags.drug;
        const fillColor = drugColorMap.value[drug] || [128, 128, 128]; // Default to grey if not found
        const lineColor = [0, 0, 0]; // You can choose to have a fixed line color or map it similarly

        // Calculate the top and bottom boundaries of the group
        const firstOffset = exemplarYOffsets.value.get(
            uniqueExemplarKey(firstExemplar)
        )!;
        const lastOffset = exemplarYOffsets.value.get(
            uniqueExemplarKey(group[group.length - 1])
        )!;

        const groupTop = firstOffset - exemplarHeight.value;
        const groupBottom = lastOffset;

        // Create a single histogram layer that spans the full vertical extent of the group
        placeholderLayer.push(
            new PolygonLayer({
                id: `exemplar-sideways-histogram-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: [group], // Just need one polygon for the group
                getPolygon: () => {
                    return [
                        [-hGap - histWidth, groupBottom],
                        [-hGap, groupBottom],
                        [-hGap, groupTop],
                        [-hGap - histWidth, groupTop],
                        [-hGap - histWidth, groupBottom],
                    ];
                },
                getLineColor: lineColor,
                getFillColor: fillColor,
                getLineWidth: 0,
            })
        );

        // Add line layers for the entire group to show division lines
        const lineData = [
            {
                coordinates: [
                    [-hGap - 0.25 * histWidth, groupBottom],
                    [-hGap - 0.25 * histWidth, groupTop],
                ],
            },
        ];

        placeholderLayer.push(
            new LineLayer({
                id: `exemplar-sideways-histogram-line-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: lineData,
                getSourcePosition: (d: { coordinates: [number, number] }) =>
                    d.coordinates[0],
                getTargetPosition: (d: { coordinates: [number, number] }) =>
                    d.coordinates[1],
                getColor: [0, 0, 0], // Black color for the line
                getWidth: 1, // Line width in pixels
            })
        );

        const yOffset = (groupBottom + groupTop) / 2; // Centered vertically

        const textData: TextDatum[] = [
            {
                coordinates: [
                    -hGap - 0.125 * histWidth, // Offset slightly to the right
                    yOffset,
                ],
                drug: firstExemplar.tags.drug,
                conc: firstExemplar.tags.conc,
            },
        ];

        // Updated TextLayer to use dynamic text
        placeholderLayer.push(
            new TextLayer({
                id: `exemplar-sideways-histogram-text-${uniqueExemplarKey(
                    firstExemplar
                )}`,
                data: textData,
                getPosition: (d: TextDatum) => d.coordinates,
                getText: (d: TextDatum) => `${d.drug} ${d.conc}um`,
                sizeScale: 1,
                sizeUnits: 'common',
                sizeMaxPixels: 15,
                getAngle: 90, // 90 degrees counter clockwise
                getColor: [0, 0, 0], // Black color
                billboard: true,
                textAnchor: 'middle',
                alignmentBaseline: 'middle',
            })
        );
    }

    return placeholderLayer;
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
