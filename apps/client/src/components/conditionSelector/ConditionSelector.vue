<script setup lang="ts">
import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount,
    onUpdated,
    watch,
} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import {
    useConditionSelectorStore,
    type Axis,
} from '@/stores/componentStores/conditionSelectorStore';
import ConditionSelectorDropDown from './ConditionSelectorDropdown.vue';
import ConditionChart from './ConditionChart.vue';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import ConditionSelectorCompareView from './ConditionSelectorCompareView.vue';
const globalSettings = useGlobalSettings();
const conditionSelectorStore = useConditionSelectorStore();
const datasetSelectionUntrrackedStore = useDatasetSelectionStore();
const { currentExperimentMetadata } = storeToRefs(
    datasetSelectionUntrrackedStore
);
import { useElementSize } from '@vueuse/core';

const {
    xLabels,
    yLabels,
    selectedXTag,
    selectedYTag,
    selectedGrid,
    selectedIndividualAxes,
    selectedIndividualYAxis,
    axesOptions,
} = storeToRefs(conditionSelectorStore);

const facetContainer = ref(null);
const compareContainer = ref(null);

const { width: gridWidth, height: gridHeight } = useElementSize(facetContainer);
const { width: compareWidth, height: compareHeight } =
    useElementSize(compareContainer);

const hoveredColumn = ref<number | null>(null);
const hoveredRow = ref<number | null>(null);
const hoveredAll = ref<boolean>(false);

const size = computed(() => {
    //Protects against svg values being below 0.
    const defaultValue = 32;
    return Math.max(
        Math.min(
            gridWidth.value / xLabels.value.length - 4,
            gridHeight.value / yLabels.value.length - 10
        ),
        defaultValue
    );
});

const width = computed(() => {
    return {
        width: `${size.value}px`,
    };
});

const maxHeight = computed(() => {
    return {
        'max-height': `${size.value}px`,
    };
});
const heightWidth = computed(() => {
    return {
        height: `${size.value}px`,
        width: `${size.value}px`,
    };
});

function handleLabelMouseOver(axis: Axis, index: number) {
    if (axis === 'x-axis') {
        hoveredColumn.value = index;
    } else {
        hoveredRow.value = index;
    }
}

function handleLabelMouseLeave() {
    hoveredColumn.value = null;
    hoveredRow.value = null;
}

function handleAllMouseOver() {
    hoveredAll.value = true;
}

function handleAllMouseLeave() {
    hoveredAll.value = false;
}
const chartLineWidth = 2;

const tab = ref('facet');

function determineSelected(elx: string, ely: string): boolean {
    return (
        conditionSelectorStore.getSelectedGridValue(elx, ely) ||
        conditionSelectorStore.allSelected()
    );
}
</script>

<template>
    <div class="flex column no-wrap full-height">
        <q-toolbar>
            <q-tabs
                v-model="tab"
                dense
                no-caps
                inline-label
                class="text-grey-10 q-ml-sm"
                indicator-color="grey"
            >
                <q-tab name="facet">
                    <div class="flex items-center">
                        <q-icon
                            name="apps"
                            size="xs"
                            :class="{
                                'custom-dark': globalSettings.darkMode,
                            }"
                        />
                        <span
                            class="q-ml-sm text-body2"
                            :class="{
                                'custom-dark': globalSettings.darkMode,
                            }"
                        >
                            Facet
                        </span>
                    </div>
                </q-tab>

                <q-tab name="compare">
                    <div class="flex items-center">
                        <q-icon
                            name="stacked_line_chart"
                            size="xs"
                            :class="{
                                'custom-dark': globalSettings.darkMode,
                            }"
                        />
                        <span
                            class="q-ml-sm text-body2"
                            :class="{
                                'custom-dark': globalSettings.darkMode,
                            }"
                        >
                            Compare
                        </span>
                    </div>
                </q-tab>
            </q-tabs>
            <q-space />
            <div class="flex items-center justify-end">
                <span
                    class="text-body2 q-mr-sm"
                    :class="{ 'custom-dark': globalSettings.darkMode }"
                >
                    Axes:
                </span>
                <q-select
                    v-model="selectedIndividualAxes"
                    :options="axesOptions"
                    dense
                    flat
                    class="text-grey-10"
                    :dark="globalSettings.darkMode"
                />
            </div>
        </q-toolbar>
        <q-tab-panels
            v-model="tab"
            animated
            class="flex items-center flex-grow-1"
            :dark="globalSettings.darkMode"
        >
            <q-tab-panel name="facet">
                <div class="condition-selector-container">
                    <div class="items-center justify-center flex y-tag">
                        <div>
                            <ConditionSelectorDropDown axis="y-axis" />
                        </div>
                    </div>
                    <div
                        class="items-center justify-center flex condition-charts-container"
                    >
                        <div class="justify-around align-center column">
                            <button
                                v-for="(labelY, idy) in yLabels"
                                :key="idy"
                                @mouseover="
                                    () => handleLabelMouseOver('y-axis', idy)
                                "
                                @mouseleave="() => handleLabelMouseLeave()"
                                @click="
                                    () =>
                                        conditionSelectorStore.clickConditionChartRow(
                                            idy
                                        )
                                "
                                :class="`row justify-center align-center y-label ${
                                    hoveredAll ? 'hovered' : ''
                                }`"
                                :style="maxHeight"
                            >
                                <div
                                    class="row justify-center align-center flex y-label-text"
                                >
                                    {{ labelY }}
                                </div>
                            </button>
                        </div>
                        <div
                            ref="facetContainer"
                            class="items-center justify-center column chart-area"
                        >
                            <div
                                v-for="(ely, idy) in yLabels"
                                :key="`${idy}-${yLabels.join(',')}`"
                                class="chart-row row justify-around align-center no-wrap"
                            >
                                <div
                                    v-for="(elx, idx) in xLabels"
                                    :key="`${idx}-${xLabels.join(',')}`"
                                    :class="`chart flex justify-center align-end ${
                                        idx === hoveredColumn ||
                                        idy === hoveredRow ||
                                        hoveredAll
                                            ? 'hovered'
                                            : ''
                                    } ${
                                        determineSelected(elx, ely)
                                            ? 'selected'
                                            : 'unselected'
                                    }`"
                                    :style="heightWidth"
                                    style="position: relative"
                                    @click="
                                        () =>
                                            conditionSelectorStore.clickConditionChart(
                                                idx,
                                                idy
                                            )
                                    "
                                >
                                    <ConditionChart
                                        :yIndex="idy"
                                        :tags="[
                                            [
                                                `${selectedXTag}`,
                                                `${elx.toString()}`,
                                            ],
                                            [
                                                `${selectedYTag}`,
                                                `${ely.toString()}`,
                                            ],
                                        ]"
                                        :xAxisName="`${
                                            currentExperimentMetadata
                                                ?.headerTransforms?.frame ??
                                            'Test'
                                        }`"
                                        :selected="determineSelected(elx, ely)"
                                        :chartLineWidth="chartLineWidth"
                                        :height="size"
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            class="items-center justify-center flex all-section full-height"
                            @mouseover="handleAllMouseOver"
                            @click="
                                () =>
                                    conditionSelectorStore.clickConditionChartAll()
                            "
                            @mouseleave="handleAllMouseLeave"
                        >
                            All
                        </button>
                        <div class="items-center justify-around row">
                            <button
                                v-for="(labelX, idx) in xLabels"
                                :key="idx"
                                @mouseover="
                                    () => handleLabelMouseOver('x-axis', idx)
                                "
                                @mouseleave="() => handleLabelMouseLeave()"
                                @click="
                                    () =>
                                        conditionSelectorStore.clickConditionChartColumn(
                                            idx
                                        )
                                "
                                :class="`row justify-center align-center flex x-label ${
                                    hoveredAll ? 'hovered' : ''
                                }`"
                            >
                                <div :style="width">
                                    {{ labelX }}
                                </div>
                            </button>
                        </div>
                    </div>
                    <div class="items-start justify-center flex">
                        <svg
                            class="legend-svg"
                            width="50"
                            style="position: relative; overflow: visible"
                            height="50"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <line
                                stroke="currentColor"
                                x1="0"
                                y1="20"
                                x2="15"
                                y2="20"
                                stroke-width="2"
                            />
                            <text
                                x="20"
                                y="23"
                                font-family="Arial"
                                font-size="10"
                                fill="currentColor"
                            >
                                Selected
                            </text>
                            <line
                                stroke="currentColor"
                                x1="0"
                                y1="35"
                                x2="15"
                                y2="35"
                                stroke-width="1"
                            />
                            <text
                                x="20"
                                y="42"
                                font-family="Arial"
                                font-size="10"
                                fill="currentColor"
                            >
                                Unselected
                            </text>
                            <rect
                                class="legend-rect"
                                fill="grey"
                                opacity="0.3"
                                x="0"
                                width="15"
                                y="35"
                                height="8"
                            />
                        </svg>
                    </div>
                    <div class="items-center justify-center flex x-tag">
                        <ConditionSelectorDropDown axis="x-axis" />
                    </div>
                </div>
            </q-tab-panel>

            <q-tab-panel name="compare">
                <div
                    class="full-height full-width flex justify-center align-center"
                    ref="compareContainer"
                >
                    <ConditionSelectorCompareView
                        :xAxisName="`${
                            currentExperimentMetadata?.headerTransforms
                                ?.frame ?? 'Test'
                        }`"
                        :yAxisName="`${selectedIndividualYAxis ?? 'Test'}`"
                        :width="compareWidth"
                        :height="compareHeight - 40"
                    />
                </div>
            </q-tab-panel>
        </q-tab-panels>
    </div>
</template>

<style scoped lang="scss">
$border: 1px solid #9ca3af;
.condition-selector-container {
    grid-template-columns: 60px 1fr;
    grid-template-rows: 1fr 60px;
    font-size: 0.8rem;
    display: grid;
    width: 100%;
    height: 100%;
    & > div:not(.condition-charts-container) {
        width: 100%;
        height: 100%;
    }
    .y-tag {
        font-size: 1.2rem;
        div {
            transform: rotate(-90deg);
        }
    }
    .x-tag {
        font-size: 1.2rem;
    }

    .condition-charts-container {
        grid-template-columns: 60px 1fr;
        grid-template-rows: 1fr 60px;
        display: grid;
        width: 100%;
        height: 100%;
        & > div {
            width: 100%;
            height: 100%;
        }
        .y-label {
            width: 100%;
            flex: 1;
        }
        .x-label {
            height: 100%;
        }
        .y-label,
        .x-label {
            cursor: pointer;
            text-align: center;
            border-radius: 2px;
            &.hovered,
            &:hover {
                outline: $border;
            }
        }
    }

    .chart-area {
        .chart-row {
            flex: 1;
            width: 100%;
            .chart {
                box-sizing: border-box;
                border-radius: 2px;
                cursor: pointer;
                &:hover,
                &.hovered {
                    outline: $border;
                }
                &.unselected {
                    opacity: 0.3;
                }
            }
        }
    }
}

.all-section {
    border-radius: 2px;
    &:hover {
        outline: $border;
    }
}

.custom-dark {
    color: white;

    .q-tabs,
    .q-tab,
    .q-icon,
    .text-body2,
    .legend-svg {
        stroke: currentColor;
        fill: currentColor;
    }

    /* Maintain grey color for the rect in the legend */
    .legend-svg .legend-rect {
        fill: #cccccc;
    }
}
</style>
