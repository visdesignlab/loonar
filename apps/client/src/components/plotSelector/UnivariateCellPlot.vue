<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import type { PropType } from 'vue';
import * as vg from '@uwdata/vgplot';
import {
    useSelectionStore,
    type DataSelection,
    type AttributeChart
} from '@/stores/interactionStores/selectionStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { storeToRefs } from 'pinia';
import FilterEditMenu from './FilterEditMenu.vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { QItemSection } from 'quasar';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';

const datasetSelectionStore = useDatasetSelectionStore();
const { currentExperimentMetadata } = storeToRefs(
    datasetSelectionStore
);

const globalSettings = useGlobalSettings();
const selectionStore = useSelectionStore();
const {showRelativeCell, showRelativeTrack} = storeToRefs(selectionStore);
const { cellLevelSelection, trackLevelSelection, cellLevelFilter, trackLevelFilter } = useMosaicSelectionStore();

// Define Plot Emits and Props
const props = defineProps({
    plotName: {
        type: String as PropType<string>,
        required: true,
    },
    attributeType: {
        type: String as PropType<AttributeChart['type']>,
        required: true,
        validator: (value: string) => ['track', 'cell'].includes(value),
    },
    attributeChart:{
        type: Object as PropType<AttributeChart>,
        required: true
    }
});

const plotContainer = ref<HTMLDivElement | null>(null);
const charts = ref<null | HTMLElement>(null);
const isLoading = ref<boolean>(true);
let observer: MutationObserver | null = null;


const showRelative = computed(() => {
    return props.attributeType === 'cell' ? showRelativeCell.value : showRelativeTrack.value
})

// Styling for "relative" charts.
const $params = {
    style: showRelative.value ? vg.Param.value('display:block') : vg.Param.value('display:none'),
}

watch(showRelative, (isShown) => {
    if(isShown){
        $params.style.update('display:block')
    } else {
        $params.style.update('display: none')
    }
})


// Creates charts when reference is available.
// Incorporates loading.
watch(
    [plotContainer],
    ([newPlotContainer]) => {
        if (newPlotContainer) {
            // Determine which selection to use
            const mosaicSelection =
                props.attributeType === 'cell'
                    ? cellLevelSelection
                    : trackLevelSelection;
            const mosaicFilter = 
                props.attributeType === 'cell'
                    ? cellLevelFilter
                    : trackLevelFilter;
            // Determine which dataset to use
            let dataSetName = `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`;
            if (props.attributeType === 'track') {
                dataSetName = `${dataSetName}_aggregate`;
            }

            // Create the plot
            charts.value = makePlot(
                props.plotName,
                mosaicSelection,
                mosaicFilter,
                dataSetName
            );
            if (charts.value) {
                plotContainer.value?.appendChild(charts.value);
                observer = new MutationObserver((mutationsList) => {
                    for (const mutation of mutationsList) {
                        if (
                            mutation.type === 'childList' &&
                            mutation.addedNodes.length > 0
                        ) {
                            isLoading.value = false;
                            observer?.disconnect();
                            break;
                        }
                    }
                });

                // Observe the SVG for changes to its child elements
                observer.observe(charts.value, {
                    childList: true,
                    subtree: true,
                });
            }
        }
    },
    { immediate: true }
);

// Vg Plot
function makePlot(column: string, mosaicSelection: any, mosaicFilter:any, datasetName: string) {
    try {
        return vg.vconcat(
            vg.plot(
                // Currently Selected Data
                vg.rectY(vg.from(datasetName, { filterBy: mosaicSelection }), {
                    x: vg.bin(column, {steps:100}),
                    y:vg.count(),
                    fill: '#377eb8',
                    opacity: 1,
                    inset: 0.2
                }),
                vg.marginBottom(30),
                vg.marginTop(5),
                vg.marginLeft(20),
                vg.marginRight(20),
                vg.width(268),
                vg.height(70),
                vg.style({ 'font-size': '.85em' }),
                vg.xLabelAnchor('center'),
                vg.xTickPadding(8),
                vg.xLabelOffset(38),
                vg.xInsetLeft(0),
                vg.xInsetRight(0),
                vg.xTickSpacing(100),
                vg.yAxis(null),
                vg.xLine(false),
                vg.style($params.style)
            ),
            vg.plot(
                // Background grey data
                vg.rectY(vg.from(datasetName, {filterBy: mosaicFilter }), {
                    x: vg.bin(column, {steps:100}),
                    y: vg.count(),
                    fill: '#cccccc',
                    inset: 0.2,
                }),
                // Currently Selected Data
                vg.rectY(vg.from(datasetName, { filterBy: mosaicSelection }), {
                    x: vg.bin(column, {steps:100}),
                    y:vg.count(),
                    // div: vg.sql`"count"/"sum"`,
                    fill: '#377eb8',
                    opacity: 1,
                    inset: 0.2
                }),
                vg.marginBottom(45),
                vg.marginTop(5),
                vg.marginLeft(20),
                vg.marginRight(20),
                vg.width(268),
                vg.height(80),
                // vg.style({ 'font-size': '.85em' }),
                vg.xLabelAnchor('center'),
                vg.xTickPadding(8),
                vg.xLabelOffset(38),
                vg.xInsetLeft(0),
                vg.xInsetRight(0),
                vg.xTickSpacing(100),
                vg.yAxis(null),
                vg.xLine(false),
                vg.xNice(false),
                vg.xAxis(true),
            )
        );
    } catch (error) {
        console.error(`Error with plot: ${error}`)
    }
}

const rangeModel = computed({
    get() {
        return { min: props.attributeChart.range[0], max: props.attributeChart.range[1] };
    },

    set(newValue) {
        // Turn this into a function in store.
        const selection = selectionStore.dataSelections.find((selection: DataSelection) => {
            return selection.plotName === props.attributeChart.plotName
        })
        if(selection){
            selection.range[0] = newValue.min;
            selection.range[1] = newValue.max;
        } else {
            const newSelection: DataSelection = {
                ...props.attributeChart,
                range: [newValue.min, newValue.max],
            }
            selectionStore.addSelection(newSelection)
        }
        props.attributeChart.range[0] = newValue.min;
        props.attributeChart.range[1] = newValue.max;
    },
});

function handleRangeUpdate(newRange: { min: number; max: number }) {
    rangeModel.value = newRange;
}
</script>

<template>
    <div>
        <q-item-section class="chart-container">
            <div ref="plotContainer">
                <FilterEditMenu
                    :plot-name="props.plotName"
                    :initial-min="rangeModel.min"
                    :initial-max="rangeModel.max"
                    filterType="selection"
                    :attributeType="props.attributeType"
                    @update:range="handleRangeUpdate"
                />
                <!-- Uses same width and height as single chart to replace the chart. -->
                <div
                    v-if="isLoading"
                    style="width: 268px; height: 85px; gap: 10px"
                    class="flex justify-center align-center"
                >
                    <q-spinner />
                    <div class="text-caption">Loading chart</div>
                </div>
                <div 
                    v-if="!isLoading"
                    class="q-range-container"
                >
                    <q-range
                        v-model="rangeModel"
                        :min="props.attributeChart.maxRange[0]"
                        :max="props.attributeChart.maxRange[1]"
                        :step="0.001"
                        :left-label-value="rangeModel.min.toFixed(2)"
                        :right-label-value="rangeModel.max.toFixed(2)"
                        label
                        thumb-size="14px"
                        track-size="2px"
                        switch-label-side
                        selection-color="#377eb8"
                        track-color="hidden"
                        :dark="globalSettings.darkMode"
                    />
                </div>
            </div>
        </q-item-section>
    </div>
</template>

<style scoped>
.q-range-container {
    padding: 0 20px;
    position: relative;
    bottom:50px;
    left: 0;
    right: 0;
}

.chart-container{
    /* position: relative; */
    border-top:1px solid #cccccc;
    border-radius:2px;
    padding-top:20px;
    margin-top:10px;
}
</style>
