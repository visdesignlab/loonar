<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onUpdated } from 'vue';
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
const conditionSelector = useConditionSelectorStore();
const datasetSelectionUntrrackedStore = useDatasetSelectionStore();
const { currentExperimentMetadata } = storeToRefs(
    datasetSelectionUntrrackedStore
);

const { xLabels, yLabels, selectedXTag, selectedYTag, selectedGrid } =
    storeToRefs(conditionSelector);

const container = ref(null);
const gridWidth = ref(0);
const gridHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

const observeContainerSize = () => {
    if (!container.value) return;
    resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            gridWidth.value = entry.contentRect.width;
            gridHeight.value = entry.contentRect.height;
        }
    });

    resizeObserver.observe(container.value);
};

onMounted(() => {
    observeContainerSize();
});

onUpdated(() => {
    // Runs when we switch tabs since we are not unmounting this component.
    if (container.value) {
        observeContainerSize();  // Force re-observation
    }
});

onBeforeUnmount(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});


const hoveredColumn = ref<number | null>(null);
const hoveredRow = ref<number | null>(null);
const hoveredAll = ref<boolean>(false);

const size = computed(() => {
        //Protects against svg values being below 0.
        const defaultValue = 20;
        return Math.max(Math.min(
            gridWidth.value / xLabels.value.length - 20,
            gridHeight.value / yLabels.value.length - 20
        ),defaultValue)
    }
);

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

const handleLabelMouseOver = (axis: Axis, index: number) => {
    if (axis === 'x-axis') {
        hoveredColumn.value = index;
    } else {
        hoveredRow.value = index;
    }
};

const handleLabelMouseLeave = () => {
    hoveredColumn.value = null;
    hoveredRow.value = null;
};

const handleAllMouseOver = () => {
    hoveredAll.value = true;
};

const handleAllMouseLeave = () => {
    hoveredAll.value = false;
};

// Basic function to just adjust stroke width of the charts based on the number of charts rendered.
const chartLineWidth = computed(() => {
    return 2;
});

const tab = ref('facet');

// Add new state for the standard dropdown
const selectedAxes = ref('Mass (pg) over Frame'); // default selected value
const axesOptions = ref([
    { label: 'Mass Over Frame', value: 'Mass (pg) over Frame ID' },
    { label: 'Area Over Frame', value: 'Area over Frame ID' },
    // Add more options as required
]);
const determineSelected = (elx:string, ely:string) => {
    return selectedGrid.value[`${selectedXTag.value}¶${elx.toString()}¶${selectedYTag.value}¶${ely.toString()}`] 
        || selectedGrid.value[`${selectedYTag.value}¶${ely.toString()}¶${selectedXTag.value}¶${elx.toString()}`]
        || conditionSelector.allSelected()
}

</script>

<template>
    <div style="display:flex;flex-direction: column;" class="full-height">
        <div class="flex justify-between items-center">
        <q-tabs
            v-model="tab"
            dense
            no-caps
            inline-label
            align="left"
            class="text-grey-10 q-pl-lg"
            indicator-color="grey"
        >
            <q-tab name="facet">
                <div class="flex items-center">
                    <q-icon name="apps" size="18px" />
                    <span class="q-ml-sm text-body2">Facet</span>
                </div>
            </q-tab>

            <q-tab name="compare">
                <div class="flex items-center">
                    <q-icon name="stacked_line_chart" size="18px" />
                    <span class="q-ml-sm text-body2">Compare</span>
                </div>
            </q-tab>
        </q-tabs>

        <div class="flex items-center justify-end mr-5" style="min-width: 300px">
            <span class="text-body2 text-grey-10 mr-2">Axes:</span>
            <q-select
                v-model="selectedAxes"
                :options="axesOptions"
                dense
                flat
                class="text-grey-10"
            />
        </div>
        </div>
        <keep-alive>
            <q-tab-panels v-model="tab" animated class="flex items-center" style="flex:1">
                    <q-tab-panel name="facet">
                        <div
                            bordered
                            :dark="globalSettings.darkMode"
                            class="inner-card condition-selector-container"
                        >
                            <div class="items-center justify-center flex y-tag">
                                <div><ConditionSelectorDropDown axis="y-axis" /></div>
                            </div>
                            <div
                                class="items-center justify-center flex condition-charts-container"
                            >
                                <div class="justify-space-around align-center column">
                                    <template v-for="(labelY, idy) in yLabels" :key="idy">
                                        <button
                                            @mouseover="
                                                () => handleLabelMouseOver('y-axis', idy)
                                            "
                                            @mouseleave="() => handleLabelMouseLeave()"
                                            @click="
                                                () =>
                                                    conditionSelector.clickConditionChartRow(
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
                                    </template>
                                </div>
                                <div
                                    ref="container"
                                    class="items-center justify-center column chart-area"
                                >
                                    <template
                                        v-for="(ely, idy) in yLabels"
                                        :key="`${idy}-${yLabels.join(',')}`"
                                    >
                                        <div
                                            class="chart-row row justify-space-around align-center"
                                        >
                                            <template
                                                v-for="(elx, idx) in xLabels"
                                                :key="`${idx}-${xLabels.join(',')}`"
                                            >
                                                <div
                                                    :class="`chart flex justify-center align-end ${
                                                        idx === hoveredColumn ||
                                                        idy === hoveredRow ||
                                                        hoveredAll
                                                            ? 'hovered'
                                                            : ''
                                                    } ${determineSelected(elx,ely) ? 'selected' : 'unselected'}` "
                                                    :style="heightWidth"
                                                    style="position: relative"
                                                    @click="
                                                        () =>
                                                            conditionSelector.clickConditionChart(
                                                                idx,
                                                                idy
                                                            )
                                                    "
                                                >
                                                        <ConditionChart
                                                            :yIndex="idy"
                                                            :tags="[
                                                                [`${selectedXTag}`,`${elx.toString()}`],
                                                                [`${selectedYTag}`,`${ely.toString()}`]
                                                            ]"
                                                            :xAxisName="`${currentExperimentMetadata?.headerTransforms?.frame ?? 'Test'}`"
                                                            :yAxisName="`${currentExperimentMetadata?.headerTransforms?.mass ?? 'Test'}`"
                                                            :selected="determineSelected(elx,ely)"
                                                            :chartLineWidth="chartLineWidth"
                                                            :height="size"
                                                        />
                                                </div>
                                            </template>
                                        </div>
                                    </template>
                                </div>
                                <button
                                    class="items-center justify-center flex all-section"
                                    @mouseover="handleAllMouseOver"
                                    @click="() => conditionSelector.clickConditionChartAll()"
                                    @mouseleave="handleAllMouseLeave"
                                >
                                    All
                                </button>
                                <div class="items-center justify-around row">
                                    <template v-for="(labelX, idx) in xLabels" :key="idx">
                                        <button
                                            @mouseover="
                                                () => handleLabelMouseOver('x-axis', idx)
                                            "
                                            @mouseleave="() => handleLabelMouseLeave()"
                                            @click="
                                                () =>
                                                    conditionSelector.clickConditionChartColumn(
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
                                    </template>
                                </div>
                            </div>
                            <div class="items-start justify-center flex">
                                <svg
                                    width="50"
                                    style="position: relative; overflow: visible"
                                    height="50"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <line
                                        x1="0"
                                        y1="20"
                                        x2="15"
                                        y2="20"
                                        stroke="black"
                                        stroke-width="3"
                                    />
                                    <text
                                        x="20"
                                        y="23"
                                        font-family="Arial"
                                        font-size="10"
                                        fill="black"
                                    >
                                        Selected
                                    </text>
                                    <line
                                        x1="0"
                                        y1="35"
                                        x2="15"
                                        y2="35"
                                        stroke="black"
                                        stroke-width="2"
                                    />
                                    <text
                                        x="20"
                                        y="42"
                                        font-family="Arial"
                                        font-size="10"
                                        fill="black"
                                    >
                                        Unselected
                                    </text>
                                    <rect fill="#cccccc" x="0" width="15" y="36" height="8" />
                                </svg>
                            </div>
                            <div class="items-center justify-center flex x-tag">
                                <ConditionSelectorDropDown axis="x-axis" />
                            </div>
                        </div>
                    </q-tab-panel>

                <q-tab-panel name="compare">
                    <ConditionSelectorCompareView />
                </q-tab-panel>
            </q-tab-panels>     
        </keep-alive>
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

.inner-card {
    border-radius: 30px;
}
</style>
