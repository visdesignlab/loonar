<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn } from 'quasar';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import LBtn from '../custom/LBtn.vue';

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

const selectionStore = useSelectionStore();
const { dataSelections } = storeToRefs(selectionStore);

const props = defineProps({
    selectorType: {
        type: String,
        required: true,
        validator: (value: string) => ['track', 'cell'].includes(value),
    },
});

const cellPlotDialogOpen = ref(false);
const trackPlotDialogOpen = ref(false);
const selectedCellAttribute = ref('');
const selectedTrackAttribute = ref('');
const selectedAggregation = ref('');
const loading = ref(true);
const loadedPlots = ref(0);
const errorPlotName = ref('');

const displayedCellPlots = computed(() => {
    const filtered = dataSelections.value.filter(
        (d) => d.displayChart && d.type === 'cell'
    );
    // console.log('Filtered Cell Plots:', filtered);
    return filtered;
});

const displayedTrackPlots = computed(() => {
    const filtered = dataSelections.value.filter(
        (d) => d.displayChart && d.type === 'track'
    );
    // console.log('Filtered Track Plots:', filtered);
    return filtered;
});

const totalCellPlots = computed(() => displayedCellPlots.value.length);
const totalTrackPlots = computed(() => displayedTrackPlots.value.length);

const aggregationOptions = [
    { label: 'Sum', value: 'SUM' },
    { label: 'Average', value: 'AVG' },
    { label: 'Count', value: 'COUNT' },
    { label: 'Minimum', value: 'MIN' },
    { label: 'Maximum', value: 'MAX' },
    { label: 'Median', value: 'MEDIAN' },
];

// On any update, computes the plots to be shown.

// Checks if specifically experiment metadata is already loaded.
const allAttributeNames = computed(() => {
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

const firstAttributeName = computed(() => {
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
            if (isInitialized && firstAttributeName.value) {
                selectionStore.addPlot(firstAttributeName.value, 'cell');

                // For testing track attributes
                selectionStore.addPlot(
                    `AVG ${firstAttributeName.value}`,
                    'track'
                );
            }
        },
        { immediate: true }
    );
});

function handlePlotLoaded() {
    loadedPlots.value++;
    if (loadedPlots.value === totalCellPlots.value + totalTrackPlots.value) {
        loading.value = false;
    }
}

// Selecting which plots to show
// function isPlotSelected(name: string): boolean {
//     const selection = selectionStore.getSelection(name);
//     if (selection === null) return false;
//     return selection.displayChart;
// }
// function togglePlotSelection(name: string) {
//     const selection = selectionStore.getSelection(name);
//     if (selection === null) {
//         selectionStore.addPlot(name, 'cell');
//         return;
//     }
//     selection.displayChart = !selection.displayChart;
// }

function onMenuButtonClick() {
    if (props.selectorType === 'cell') {
        cellPlotDialogOpen.value = !cellPlotDialogOpen.value;
    } else if (props.selectorType === 'track') {
        trackPlotDialogOpen.value = !trackPlotDialogOpen.value;
    }
}

function addCellPlotFromMenu(atr: string) {
    cellPlotDialogOpen.value = false;
    selectionStore.addPlot(`${atr}`, 'cell');
    return;
}
function addTrackPlotFromMenu(atr: string, agg: string) {
    trackPlotDialogOpen.value = false;
    selectionStore.addPlot(`${agg} ${atr}`, 'track');
    return;
}

//function handleSelectionRemoved(event: CustomEvent) {}
</script>
<template>
    <div>
        <div v-if="!experimentDataInitialized" class="flex justify-center">
            <div class="text-caption q-m-lg">No experiment selected.</div>
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
                    <q-dialog v-model="cellPlotDialogOpen" persistent>
                        <q-card :dark="globalSettings.darkMode">
                            <q-card-section>
                                <div class="text-h6">
                                    Add Cell Attribute to Display
                                </div>
                                <q-separator class="q-my-sm" />
                                <q-form
                                    class="q-gutter-md"
                                    :dark="globalSettings.darkMode"
                                >
                                    <q-select
                                        label="Select Attribute"
                                        :options="allAttributeNames"
                                        v-model="selectedCellAttribute"
                                        clickable
                                    >
                                    </q-select>

                                    <q-expansion-item>
                                        <template v-slot:header>
                                            <q-item-section
                                                >Current Cell
                                                Attributes</q-item-section
                                            >
                                        </template>
                                    </q-expansion-item>

                                    <div>
                                        <l-btn
                                            label="Add"
                                            @click="
                                                addCellPlotFromMenu(
                                                    selectedCellAttribute
                                                )
                                            "
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                            color="blue"
                                        />
                                        <l-btn
                                            label="Cancel"
                                            flat
                                            @click="onMenuButtonClick"
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                        />
                                    </div>
                                </q-form>
                            </q-card-section>
                        </q-card>
                    </q-dialog>

                    <!-- Q-Dialog for 'Track' Selector -->
                    <q-dialog v-model="trackPlotDialogOpen" persistent>
                        <q-card :dark="globalSettings.darkMode">
                            <q-card-section>
                                <div class="text-h6">
                                    Add Track Attribute to Display
                                </div>
                                <q-separator class="q-my-sm" />
                                <q-form
                                    class="q-gutter-md"
                                    :dark="globalSettings.darkMode"
                                >
                                    <q-select
                                        label="Select Attribute"
                                        :options="allAttributeNames"
                                        v-model="selectedTrackAttribute"
                                        clickable
                                    >
                                    </q-select>
                                    <q-select
                                        label="Select Aggregation"
                                        :options="aggregationOptions"
                                        option-value="value"
                                        option-label="label"
                                        v-model="selectedAggregation"
                                        emit-value
                                        clickable
                                    >
                                    </q-select>

                                    <q-expansion-item>
                                        <template v-slot:header>
                                            <q-item-section
                                                >Current Track
                                                Attributes</q-item-section
                                            >
                                        </template>
                                    </q-expansion-item>

                                    <div>
                                        <l-btn
                                            label="Add"
                                            @click="
                                                addTrackPlotFromMenu(
                                                    selectedTrackAttribute,
                                                    selectedAggregation
                                                )
                                            "
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                            color="blue"
                                        />
                                        <l-btn
                                            label="Cancel"
                                            flat
                                            @click="onMenuButtonClick"
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                        />
                                    </div>
                                </q-form>
                            </q-card-section>
                        </q-card>
                    </q-dialog>
                </q-btn>
            </div>
            <template v-if="props.selectorType === 'cell'">
                <UnivariateCellPlot
                    v-for="dataSelection in displayedCellPlots"
                    :key="dataSelection.plotName"
                    :plot-name="dataSelection.plotName"
                    :attribute-type="'cell'"
                    @plot-loaded="handlePlotLoaded"
                    @plot-error="handlePlotError"
                />
            </template>
            <template v-if="props.selectorType === 'track'">
                <UnivariateCellPlot
                    v-for="dataSelection in displayedTrackPlots"
                    :key="dataSelection.plotName"
                    :plot-name="dataSelection.plotName"
                    :attribute-type="'track'"
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
