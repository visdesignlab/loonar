<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn } from 'quasar';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import {
    useSelectionStore,
    emitter,
} from '@/stores/interactionStores/selectionStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useNotificationStore } from '@/stores/misc/notificationStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
const datasetSelectionStore = useDatasetSelectionStore();
const globalSettings = useGlobalSettings();
const notificationStore = useNotificationStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(
    datasetSelectionStore
);

const props = defineProps({
    selectorType: {
        type: String,
        required: true,
        validator: (value: string) => ['Track', 'Cell'].includes(value),
    },
});

const cellPlotMenuOpen = ref(false);
const trackPlotDialogOpen = ref(false);
const selectedAttribute = ref('');
const selectedAggregation = ref('');
const loading = ref(true);
const loadedPlots = ref(0);
const displayedCellPlots = computed(() => {
    const filtered = dataSelections.value.filter(
        (d) => d.displayChart && d.type === 'cell'
    );
    // console.log('Filtered Cell Plots:', filtered);
    return filtered;
});

const totalCellPlots = computed(() => displayedCellPlots.value.length);

const aggregationOptions = [
    { label: 'Sum', value: 'sum' },
    { label: 'Average', value: 'average' },
    { label: 'Count', value: 'count' },
    { label: 'Minimum', value: 'min' },
    { label: 'Maximum', value: 'max' },
];

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
        message: `An Error occured while loading the plot ${errorPlotName.value}`,
    });

    // Deselect the plot and remove it from the shown plots
    selectionStore.removePlotWithErrors(plotName);
}

// Adds a plot initially when first loading.
onMounted(() => {
    emitter.on('plot-error', handlePlotError);
    watch(
        experimentDataInitialized,
        (isInitialized) => {
            if (isInitialized && firstPlotName.value) {
                selectionStore.addPlot(firstPlotName.value, 'cell');

                // For testing track attributes
                selectionStore.addPlot('avg_mass', 'track');
            }
        },
        { immediate: true }
    );
});

function handlePlotLoaded() {
    loadedPlots.value++;
    if (loadedPlots.value === totalCellPlots.value) {
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
        selectionStore.addPlot(name, 'cell');
        return;
    }
    selection.displayChart = !selection.displayChart;
}

function onMenuButtonClick() {
    trackPlotDialogOpen.value = true;
}

function onSubmit() {
    trackPlotDialogOpen.value = false;
}

function handleSelectionRemoved(event: CustomEvent) {
    // clearMosaicSource(event.detail);
}

// window.addEventListener(
//     'selectionRemoved',
//     handleSelectionRemoved as EventListener
// );
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
                    @click="onMenuButtonClick"
                >
                    <!-- Q-Menu for 'Cell' Selector -->
                    <q-menu
                        v-if="props.selectorType === 'Cell'"
                        v-model="cellPlotMenuOpen"
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

                    <!-- Q-Dialog for 'Track' Selector -->
                    <q-dialog
                        v-if="props.selectorType === 'Track'"
                        v-model="trackPlotDialogOpen"
                        persistent
                    >
                        <q-card :dark="globalSettings.darkMode">
                            <q-card-section>
                                <div class="text-h6">
                                    Add Track Attribute to Display
                                </div>
                                <q-separator class="q-my-sm" />
                                <q-form
                                    @submit="onSubmit"
                                    class="q-gutter-md"
                                    :dark="globalSettings.darkMode"
                                >
                                    <q-select
                                        label="Select Attribute"
                                        :options="allPlotNames"
                                        v-model="selectedAttribute"
                                        clickable
                                    >
                                    </q-select>
                                    <q-select
                                        label="Select Aggregation"
                                        :options="aggregationOptions"
                                        v-model="selectedAggregation"
                                        clickable
                                    >
                                    </q-select>

                                    <div>
                                        <q-btn
                                            label="Add"
                                            type="submit"
                                            color="primary"
                                            :dark="globalSettings.darkMode"
                                        />
                                        <q-btn
                                            label="Cancel"
                                            color="primary"
                                            flat
                                            @click="trackPlotDialogOpen = false"
                                            class="q-ml-sm"
                                            :dark="globalSettings.darkMode"
                                        />
                                    </div>
                                </q-form>
                            </q-card-section>
                        </q-card>
                    </q-dialog>
                </q-btn>
            </div>
            <template v-if="props.selectorType === 'Cell'">
                <UnivariateCellPlot
                    v-for="dataSelection in displayedCellPlots"
                    :key="dataSelection.plotName"
                    :plot-name="dataSelection.plotName"
                    :attribute-type="'Cell'"
                    @plot-loaded="handlePlotLoaded"
                    @plot-error="handlePlotError"
                />
            </template>
            <template v-if="props.selectorType === 'Track'">
                <UnivariateCellPlot
                    :key="'avg_mass'"
                    :plot-name="'avg_mass'"
                    :attribute-type="'Track'"
                    @plot-loaded="handlePlotLoaded"
                    @plot-error="handlePlotError"
                />
            </template>
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
