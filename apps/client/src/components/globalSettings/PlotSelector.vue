<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn, QDialog, QCard, QCardSection, QCardActions } from 'quasar';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import {
    useSelectionStore,
    emitter,
} from '@/stores/interactionStores/selectionStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useNotificationStore } from '@/stores/misc/notificationStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
const datasetSelectionStore = useDatasetSelectionStore();
const {mosaicSelection, clearMosaicSource} = useMosaicSelectionStore();
const globalSettings = useGlobalSettings();
const notificationStore = useNotificationStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(
    datasetSelectionStore
);

const menuOpen = ref(false);
const loading = ref(true);
const loadedPlots = ref(0);
const displayedPlots = computed(() =>
    dataSelections.value.filter((d) => d.displayChart)
);
const totalPlots = computed(() => displayedPlots.value.length);

// On any update, computes the plots to be shown.

// Checks if specifically experiment metadata is already loaded.
const allPlotNames = computed(() => {
    if (
        experimentDataInitialized.value &&
        currentExperimentMetadata.value &&
        currentExperimentMetadata.value.headers
    ) {
        return currentExperimentMetadata.value.headers;
    } else {
        return [];
    }
});

const firstPlotName = computed(() => {
    if (
        experimentDataInitialized.value &&
        currentExperimentMetadata.value &&
        currentExperimentMetadata.value.headers &&
        currentExperimentMetadata.value.headers.length > 0
    ) {
        // does headerTransforms['mass'] exist
        const headerTransforms =
            currentExperimentMetadata.value.headerTransforms;
        if (
            headerTransforms &&
            headerTransforms['mass'] &&
            headerTransforms['mass'] !== ''
        ) {
            return headerTransforms['mass'];
        } else {
            // otherwise return first header from headers
            return currentExperimentMetadata.value.headers[0];
        }
    } else {
        return '';
    }
});

const selectionStore = useSelectionStore();

const { dataSelections } = storeToRefs(selectionStore);

const errorPlotName = ref('');

// If there is a plot loading here, a dialog is displayed.
function handlePlotError(plotName: string) {
    errorPlotName.value = plotName;

    notificationStore.notify({
        type: 'problem',
        message: `An Error occured while loading the plot ${errorPlotName}`,
    });

    // Deselect the plot and remove it from the shown plots
    selectionStore.removePlotWithErrors(plotName);

    clearMosaicSource(plotName);
}

// Adds a plot initially when first loading.
onMounted(() => {
    emitter.on('plot-error', handlePlotError);
    watch(
        experimentDataInitialized,
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
    if (loadedPlots.value === totalPlots.value) {
        loading.value = false;
    }
}


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
    clearMosaicSource(event.detail);
}

window.addEventListener(
    'selectionRemoved',
    handleSelectionRemoved as EventListener
);
</script>
<template>
    <div>
        <div v-if="!experimentDataInitialized" class="flex justify-center">
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
