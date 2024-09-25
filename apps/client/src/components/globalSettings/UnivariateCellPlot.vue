<script lang="ts" setup>
import { ref, watch, onMounted, computed } from 'vue';
import type { PropType } from 'vue';
import * as vg from '@uwdata/vgplot';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import {
    useSelectionStore,
    type DataSelection,
} from '@/stores/interactionStores/selectionStore';
import { storeToRefs } from 'pinia';
import FilterEditMenu from './FilterEditMenu.vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { QItemSection } from 'quasar';

// Initialise Data
const globalSettings = useGlobalSettings();
const cellMetaData = useCellMetaData();
const { dataInitialized } = storeToRefs(cellMetaData);
const selectionStore = useSelectionStore();

// Define Plot Emits and Props
const emit = defineEmits(['selectionChange', 'plot-loaded', 'plot-error']);
const props = defineProps({
    plotName: {
        type: String as PropType<string>,
        required: true,
    },
    plotBrush: {
        type: Object as PropType<any>,
        required: true,
    },
});

// Vg Plot
function makePlot(column: string) {
    try {
        return vg.plot(
            // Background grey data
            vg.rectY(vg.from('current_cell_metadata'), {
                x: vg.bin(column),
                y: vg.count(),
                fill: '#cccccc',
                inset: 1,
            }),
            // Currently Selected Data
            vg.rectY(
                vg.from('current_cell_metadata', { filterBy: props.plotBrush }),
                {
                    x: vg.bin(column),
                    y: vg.count(),
                    fill: '#377eb8',
                    opacity: 1,
                    inset: 1,
                }
            ),
            vg.marginBottom(45),
            vg.marginTop(5),
            vg.marginLeft(20),
            vg.marginRight(20),
            vg.width(268),
            vg.height(85),
            vg.style({ 'font-size': '.85em' }),
            vg.xDomain(vg.Fixed),
            vg.xLabelAnchor('center'),
            vg.xTickPadding(8),
            vg.xLabelOffset(38),
            vg.xInsetLeft(0),
            vg.xInsetRight(0),
            vg.xTickSpacing(100),
            vg.yAxis(null),
            vg.xLine(false),
            vg.xNice(false)
        );
    } catch (error) {
        emit('plot-error', props.plotName);
    }
}

// Handle Loading of Everything
const charts = ref<null | HTMLElement>(null);
const loaded = ref(false);

// Creates the Plots.
async function createCharts() {
    try {
        charts.value = makePlot(props.plotName);
        if (plotContainer.value) {
            plotContainer.value.appendChild(charts.value!);
            loaded.value = true;
        }
    } catch (error) {
        console.error('Error creating charts:', error);
        emit('plot-error', props.plotName);
    }
}

// Checks when everything has loaded
watch(loaded, () => {
    handlePlotLoading();
});

// Waits for data range to load, then waits a bit, then notifies plotselector to show everything.
async function handlePlotLoading() {
    try {
        // Wait for 0.5 seconds before emitting the plot-loaded event
        await new Promise((resolve) => setTimeout(resolve, 500));
        emit('plot-loaded');
    } catch (error) {
        console.error('Error in handlePlotLoading:', error);
        emit('plot-error', props.plotName);
    }
}

// Handle Rendering
onMounted(() => {
    if (dataInitialized.value) {
        createCharts();
    }
});

// Waits for data to be initialized before creating charts
watch(dataInitialized, createCharts);

const plotContainer = ref<HTMLDivElement | null>(null);

const selection = computed<DataSelection>(() => {
    const s = selectionStore.getSelection(props.plotName);
    if (!s) {
        return {
            plotName: 'not found',
            type: 'cell',
            range: [0, 0],
            maxRange: [0, 0],
            displayChart: true,
        };
    }
    return s;
});

const rangeModel = computed({
    get() {
        return { min: selection.value.range[0], max: selection.value.range[1] };
    },
    set(newValue) {
        selection.value.range[0] = newValue.min;
        selection.value.range[1] = newValue.max;
    },
});

function handleRangeUpdate(newRange: { min: number; max: number }) {
    rangeModel.value = newRange;
}
</script>

<template>
    <div>
        <q-item-section style="position: relative">
            <div ref="plotContainer" style="position: relative">
                <FilterEditMenu
                    :plot-name="props.plotName"
                    :initial-min="rangeModel.min"
                    :initial-max="rangeModel.max"
                    type="selection"
                    @update:range="handleRangeUpdate"
                />

                <div class="q-range-container">
                    <q-range
                        v-model="rangeModel"
                        :min="selection.maxRange[0]"
                        :max="selection.maxRange[1]"
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
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
}
</style>
@/stores/userInteraction/selectionStore @/stores/componentStores/globalSettings
@/stores/dataStores/cellMetaData
