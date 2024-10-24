<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import {
    useConditionSelector,
    type Axis,
} from '@/stores/componentStores/conditionSelectorStore';
import ConditionSelectorDropDown from './ConditionSelectorDropdown.vue';
import ConditionChart from './ConditionChart.vue';
import { storeToRefs } from 'pinia';
const globalSettings = useGlobalSettings();
const conditionSelector = useConditionSelector();
const {
    xLabels,
    yLabels,
    selectedXTag,
    selectedYTag,
    currentExperimentTags,
    selectedGrid,
 } = storeToRefs(conditionSelector)

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

onBeforeUnmount(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});

const hoveredColumn = ref<number | null>(null);
const hoveredRow = ref<number | null>(null);
const hoveredAll = ref<boolean>(false);

const size = computed(() =>
    Math.min(
        gridWidth.value / xLabels.value.length - 20,
        gridHeight.value / yLabels.value.length - 20
    )
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
}

const handleAllMouseLeave = () => {
    hoveredAll.value = false;
}

</script>

<template>
    <div class="flex items-center h-100">
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
                    <template
                        v-for="(labelY, idy) in yLabels"
                        :key="idy"
                    >
                        <div
                            @mouseover="
                                () => handleLabelMouseOver('y-axis', idy)
                            "
                            @mouseleave="() => handleLabelMouseLeave()"
                            @click="() => conditionSelector.clickConditionChartRow(idy)"
                            :class="`row justify-center align-center y-label ${hoveredAll ? 'hovered' : ''}`"
                            :style="maxHeight"
                        >
                            <div
                                class="row justify-center align-center flex y-label-text"
                            >
                                {{ labelY }}
                            </div>
                        </div>
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
                                        idy === hoveredRow || hoveredAll
                                            ? 'hovered'
                                            : ''
                                    } ${selectedGrid[`${elx.toString()}-${ely.toString()}`] || conditionSelector.allSelected() ? 'selected' : 'unselected'}` "
                                    :style="heightWidth"
                                    @click="() => conditionSelector.clickConditionChart(idx,idy)"
                                >
                                    <div>
                                        <ConditionChart
                                            :yIndex="idy"
                                            :tags="[
                                                [`${selectedXTag}`,`${elx.toString()}`],
                                                [`${selectedYTag}`,`${ely.toString()}`]
                                            ]"
                                            :xAxisName="'Frame'"
                                            :yAxisName="'Dry Mass (pg)'"
                                            :selected="selectedGrid[`${elx.toString()}-${ely.toString()}`] || conditionSelector.allSelected()"
                                        />
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                </div>
                <div 
                    class="items-center justify-center flex all-section" 
                    @mouseover="handleAllMouseOver"
                    @click="() => conditionSelector.clickConditionChartAll()"
                    @mouseleave="handleAllMouseLeave"
                >
                    All
                </div>
                <div class="items-center justify-around row">
                    <template
                        v-for="(labelX, idx) in xLabels"
                        :key="idx"
                    >
                        <div
                            @mouseover="
                                () => handleLabelMouseOver('x-axis', idx)
                            "
                            @mouseleave="() => handleLabelMouseLeave()"
                            @click="() => conditionSelector.clickConditionChartColumn(idx)"

                            :class="`row justify-center align-center flex x-label ${hoveredAll ? 'hovered' : ''}`"
                        >
                            <div :style="width">
                                {{ labelX }}
                            </div>
                        </div>
                    </template>
                </div>
            </div>
            <div class="items-center justify-center flex">Legend</div>
            <div class="items-center justify-center flex x-tag">
                <ConditionSelectorDropDown axis="x-axis" />
            </div>
        </div>
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
                border: $border;
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
                    border: $border;
                }
                &.selected{
                    // border: 5px solid blue;
                }
                &.unselected{
                    opacity:0.8
                }
            }
        }
    }
}

.all-section{
    border-radius:2px;
    &:hover{
        border: $border;
    }
}


.inner-card {
    border-radius: 30px;
}
</style>
