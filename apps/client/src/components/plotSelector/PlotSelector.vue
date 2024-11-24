<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn } from 'quasar';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import LBtn from '../custom/LBtn.vue';

import {
    useSelectionStore,
    emitter,
    type AttributeChart
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
const { dataSelections, attributeCharts, showRelativeCell, showRelativeTrack } = storeToRefs(selectionStore);

// Are these plots track or cell level?
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
const errorPlotName = ref('');


const aggregationOptions = [
    { label: 'Sum', value: 'SUM' },
    { label: 'Average', value: 'AVG' },
    { label: 'Count', value: 'COUNT' },
    { label: 'Minimum', value: 'MIN' },
    { label: 'Maximum', value: 'MAX' },
    { label: 'Median', value: 'MEDIAN' },
];

// Collects all attribute names after the data is loaded.
const allAttributeNames = computed(() => {
    if (
        experimentDataInitialized.value &&
        currentExperimentMetadata.value &&
        currentExperimentMetadata.value.headers &&
        currentExperimentMetadata.value.headers.length > 0
    ) {
        return currentExperimentMetadata.value.headers;
    } else {
        return [];
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
}
function addTrackPlotFromMenu(atr: string, agg: string) {
    trackPlotDialogOpen.value = false;
    selectionStore.addPlot(`${agg} ${atr}`, 'track');
}



function onToggleRelativeChart(){
    props.selectorType === 'cell' ? showRelativeCell.value = !showRelativeCell.value : showRelativeTrack.value = !showRelativeTrack.value
}

</script>
<template>
    <div>
        <div v-if="!experimentDataInitialized" class="flex justify-center">
            <div class="text-caption q-m-lg">No experiment selected.</div>
        </div>
        <div v-else>
            <!-- Menu Icon -->

            <div class="flex justify-between">
                <q-btn
                    class="gt-xs q-mr-sm"
                    size="12px"
                    flat
                    dense
                    round
                    icon="mdi-chart-areaspline"
                    color="grey-7"
                    @click="onToggleRelativeChart"
                >
                    <q-tooltip>Show Relative Chart</q-tooltip>
                </q-btn>
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
                    <!-- Cell Attributes Dialog -->
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

                    <!-- Track Attributes Dialog -->
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
            <!--Generate the Plots-->
            <UnivariateCellPlot
                v-for="chart in attributeCharts.filter((entry:AttributeChart) => entry.type === props.selectorType )"
                :key="chart.plotName"
                :attribute-chart="chart"
                :plot-name="chart.plotName"
                :attribute-type="props.selectorType"
                @plot-error="handlePlotError"
            />
        </div>
    </div>
</template>

<style scoped>
.q-i {
    display: flex;
    justify-content: flex-end;
}

.selected-item {
    background-color: #e0e0e0;
    color: black;
}
</style>
