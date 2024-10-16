<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import {
    useConditionSelector,
    type Axis,
} from '@/stores/componentStores/conditionSelectorStore';
import ConditionSelectorDropDown from './ConditionSelectorDropdown.vue';
import ConditionChart from './ConditionChart.vue';
const globalSettings = useGlobalSettings();
const conditionSelector = useConditionSelector();

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
        gridWidth.value / conditionSelector.xLabels.length - 20,
        gridHeight.value / conditionSelector.yLabels.length - 20
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
console.log(conditionSelector.currentExperimentTags);
console.log(conditionSelector.xLabels);
console.log('test')
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
                        v-for="(labelY, idy) in conditionSelector.yLabels"
                        :key="idy"
                    >
                        <div
                            @mouseover="
                                () => handleLabelMouseOver('y-axis', idy)
                            "
                            @mouseleave="() => handleLabelMouseLeave()"
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
                        v-for="(ely, idy) in conditionSelector.yLabels"
                        :key="idy"
                    >
                        <div
                            class="chart-row row justify-space-around align-center"
                        >
                            <template
                                v-for="(elx, idx) in conditionSelector.xLabels"
                                :key="idx"
                            >
                                <div
                                    :class="`chart flex justify-center align-center ${
                                        idx === hoveredColumn ||
                                        idy === hoveredRow || hoveredAll
                                            ? 'hovered'
                                            : ''
                                    }`"
                                    :style="heightWidth"
                                >
                                    <div>
                                        <ConditionChart
                                            :width="size"
                                            :height="size"
                                            :tags="[
                                                [`${conditionSelector.selectedXTag}`,`${elx.toString()}`],
                                                [`${conditionSelector.selectedYTag}`,`${ely.toString()}`]
                                            ]"
                                            :xAxisName="'Frame'"
                                            :yAxisName="'Dry Mass (pg)'"
                                        />
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                </div>
                <div class="items-center justify-center flex all-section" @mouseover="handleAllMouseOver" @mouseleave="handleAllMouseLeave">All</div>
                <div class="items-center justify-around row">
                    <template
                        v-for="(labelX, idx) in conditionSelector.xLabels"
                        :key="idx"
                    >
                        <div
                            @mouseover="
                                () => handleLabelMouseOver('x-axis', idx)
                            "
                            @mouseleave="() => handleLabelMouseLeave()"
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
.condition-selector-container {
    grid-template-columns: 60px 1fr;
    grid-template-rows: 1fr 60px;
    font-size: 0.8rem;
    display: grid;
    width: 100%;
    height: 100%;
    & > div:not(.condition-charts-container) {
        // border: 1px solid black;
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
            // border: 1px solid black;
        }
        .y-label {
            // margin-right:80px;
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
                border: 1px solid black;
            }
        }
    }

    .chart-area {
        .chart-row {
            flex: 1;
            width: 100%;
            .chart {
                box-sizing: border-box;
                padding:5px;
                border-radius: 2px;
                cursor: pointer;
                // border: 1px solid black;
                &:hover,
                &.hovered {
                    border:1px solid black;
                }
            }
        }
    }
}

.all-section{
    border-radius:2px;
    &:hover{
        border:1px solid black;
    }
}


.inner-card {
    border-radius: 30px;
}
</style>
