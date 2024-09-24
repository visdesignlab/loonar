<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn, QDialog, QCard, QCardSection, QCardActions } from 'quasar';
import * as vg from '@uwdata/vgplot';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import {
    useSelectionStore,
    emitter,
} from '@/stores/interactionStores/selectionStore';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useNotificationStore } from '@/stores/misc/notificationStore';

const globalSettings = useGlobalSettings();
const cellMetaData = useCellMetaData();
const notificationStore = useNotificationStore();
const { dataInitialized } = storeToRefs(cellMetaData);

interface Selection {
    [key: string]: [number, number] | undefined;
}

const menuOpen = ref(false);
const loading = ref(true);
const loadedPlots = ref(0);
const displayedPlots = computed(() =>
    dataSelections.value.filter((d) => d.displayChart)
);
const totalPlots = computed(() => displayedPlots.value.length);

// On any update, computes the plots to be shown.
const allPlotNames = computed(() => {
    return dataInitialized.value ? cellMetaData.headers : [];
});
const firstPlotName = computed(() => {
    return dataInitialized.value ? cellMetaData.headerKeys.mass : '';
});

const selectionStore = useSelectionStore();

const { dataSelections } = storeToRefs(selectionStore);

const errorPlotName = ref('');

// If there is a plot loading here, a dialog is displayed.
function handlePlotError(plotName: string) {
    // console.log('handlePlotError called with:', plotName);
    errorPlotName.value = plotName;

    notificationStore.notify({
        type: 'problem',
        message: `An Error occured while loading the plot ${errorPlotName}`,
    });

    // Deselect the plot and remove it from the shown plots
    selectionStore.removePlotWithErrors(plotName);

    mosaicSelection.value.update({
        source: plotName,
        value: null,
        predicate: null,
    });
}

// Adds a plot initially when first loading.
onMounted(() => {
    emitter.on('plot-error', handlePlotError);
    watch(
        dataInitialized,
        (isInitialized) => {
            if (isInitialized && firstPlotName.value) {
                selectionStore.addPlot(firstPlotName.value);
            }
        },
        { immediate: true }
    );
});

function handlePlotLoaded() {
    loadedPlots.value++;
    // console.log('Plot loaded');
    if (loadedPlots.value === totalPlots.value) {
        loading.value = false;
    }
}

// Mosaic selections within plots gets computed
const mosaicSelection = computed(() => vg.Selection.intersect());
const plotBrush = computed(() => {
    // console.log('plotBrush computed');

    for (let selection of dataSelections.value) {
        const source = selection.plotName;
        const min = Number(selection.range[0]);
        const max = Number(selection.range[1]);
        const value = [min, max];

        // Escape the source name to handle multi-word column names
        const escapedSource = `"${source.replace(/"/g, '""')}"`;

        const predicate = `${escapedSource} BETWEEN ${min} AND ${max}`;
        const clause = { source, value, predicate };
        mosaicSelection.value.update(clause);
    }

    return mosaicSelection.value;
});

// Selecting which plots to show
function isPlotSelected(name: string): boolean {
    const selection = selectionStore.getSelection(name);
    if (selection === null) return false;
    return selection.displayChart;
}
function togglePlotSelection(name: string) {
    const selection = selectionStore.getSelection(name);
    if (selection === null) {
        selectionStore.addPlot(name);
        return;
    }
    selection.displayChart = !selection.displayChart;
}

function handleSelectionRemoved(event: CustomEvent) {
    // console.log('handleSelectionRemoved reached');
    mosaicSelection.value.update({
        source: event.detail,
        value: null,
        predicate: null,
    });
}

window.addEventListener(
    'selectionRemoved',
    handleSelectionRemoved as EventListener
);
</script>
<template>
    <div>
        <div v-if="!dataInitialized" class="flex justify-center">
            <div class="text-h6 q-m-lg">Loading...</div>
        </div>
        <div v-else>
            <div class="q-item-section__right">
                <q-btn
                    class="gt-xs q-mr-sm"
                    size="12px"
                    flat
                    dense
                    round
                    icon="menu"
                    color="grey-7"
                >
                    <q-menu
                        v-model="menuOpen"
                        fit
                        :dark="globalSettings.darkMode"
                    >
                        <q-list
                            style="min-width: 100px; max-height: 300px"
                            class="scroll"
                        >
                            <q-item
                                v-for="name in allPlotNames"
                                :key="name"
                                clickable
                                :class="{
                                    'selected-item': isPlotSelected(name),
                                }"
                                @click.stop="togglePlotSelection(name)"
                                dense
                            >
                                <q-item-section class="plot-name">{{
                                    name
                                }}</q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </div>
            <UnivariateCellPlot
                v-for="dataSelection in displayedPlots"
                :key="dataSelection.plotName"
                :plot-name="dataSelection.plotName"
                :plot-brush="plotBrush"
                @plot-loaded="handlePlotLoaded"
                @plot-error="handlePlotError"
            />
        </div>
    </div>
</template>

<style scoped>
.q-item-section__right {
    display: flex;
    justify-content: flex-end;
}

.selected-item {
    background-color: #e0e0e0;
    color: black;
}
</style>
@/stores/userInteraction/selectionStore @/stores/componentStores/globalSettings
@/stores/dataStores/cellMetaData
