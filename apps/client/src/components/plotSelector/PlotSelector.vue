<script lang="ts" setup>
import { ref, computed, onMounted, watch, type PropType } from 'vue';
import { QBtn } from 'quasar';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import LBtn from '../custom/LBtn.vue';
import { addAggregateColumn, type AggregateObject } from '@/util/datasetLoader';
import {
    useSelectionStore,
    type AttributeChart,
} from '@/stores/interactionStores/selectionStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useNotificationStore } from '@/stores/misc/notificationStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import {
    aggregateFunctions,
    isCustomAggregateFunction,
    isStandardAggregateFunction,
    type AttributeSelection,
    type AggregateFunction,
} from './aggregateFunctions';
const datasetSelectionStore = useDatasetSelectionStore();
const globalSettings = useGlobalSettings();
const notificationStore = useNotificationStore();
const {
    experimentDataInitialized,
    currentExperimentMetadata,
    compTableName,
    aggTableName,
} = storeToRefs(datasetSelectionStore);
const selectionStore = useSelectionStore();
const { attributeCharts, showRelativeCell, showRelativeTrack } =
    storeToRefs(selectionStore);

// Are these plots track or cell level?
const props = defineProps({
    selectorType: {
        type: String as PropType<AttributeChart['type']>,
        required: true,
        validator: (value: string) => ['track', 'cell'].includes(value),
    },
});
const cellPlotDialogOpen = ref(false);
const selectedCellAttribute = ref('');

const trackPlotDialogOpen = ref(false);
const aggModel = ref<string | null>(null);
const attr1Model = ref<string | null>(null);
const attr2Model = ref<string | null>(null);
const var1Model = ref<number | string | null>(null);

const errorPlotName = ref('');

// Currently selected aggregation
const currAgg = computed<AggregateFunction | null>(() =>
    aggModel.value ? aggregateFunctions[aggModel.value] : null
);

// The selections of the currently selected aggregation
const currAggSelections = computed(
    (): Record<string, AttributeSelection> | undefined => {
        if (!currAgg.value) return;
        if (!isStandardAggregateFunction(currAgg.value)) {
            return;
        }
        return currAgg.value.selections;
    }
);

// For use in select input
const aggregationOptions = computed(() => {
    return Object.entries(aggregateFunctions).map((entry) => {
        return { label: entry[0] };
    });
});

// Collects all attribute names after the data is loaded.
const allAttributeNames = computed(() => {
    if (
        experimentDataInitialized.value &&
        currentExperimentMetadata.value &&
        currentExperimentMetadata.value.headers &&
        currentExperimentMetadata.value.headers.length > 0
    ) {
        return [
            ...currentExperimentMetadata.value.headers,
            'Mass Norm',
            'Time Norm',
        ];
    } else {
        return [];
    }
});

function onChangeAgg() {
    var1Model.value = null;
    attr2Model.value = null;
    attr1Model.value = null;
}

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
    aggModel.value = '';
    var1Model.value = null;
    attr2Model.value = null;
    attr1Model.value = null;
}
async function addTrackPlotFromMenu() {
    if (!aggModel.value) return;

    const label = aggModel.value;
    const attr1 = attr1Model.value?.toString() ?? undefined;
    const var1 = var1Model.value?.toString() ?? undefined;
    const attr2 = attr2Model.value ?? undefined;
    const functionName = aggregateFunctions[label].functionName;
    let customQuery;

    const aggFunction = aggregateFunctions[label];
    if (isCustomAggregateFunction(aggFunction)) {
        customQuery = aggFunction.customQuery;
    }

    if (
        aggTableName.value &&
        compTableName.value &&
        currentExperimentMetadata.value?.headerTransforms
    ) {
        const aggObject: AggregateObject = {
            functionName,
            attr1,
            var1,
            attr2,
            label,
            customQuery,
        };

        const name = await addAggregateColumn(
            aggTableName.value,
            compTableName.value,
            aggObject,
            currentExperimentMetadata.value?.headerTransforms
        );
        trackPlotDialogOpen.value = false;
        selectionStore.addPlot(name, 'track');
    }
}
// New reactive constant for icon color state
const isRelativeChartShown = ref(false);

// Shows or hides relative chart. Changes icon color.
function onToggleRelativeChart() {
    isRelativeChartShown.value = !isRelativeChartShown.value;

    if (props.selectorType === 'cell') {
        showRelativeCell.value = !showRelativeCell.value;
    } else if (props.selectorType === 'track') {
        showRelativeTrack.value = !showRelativeTrack.value;
    }
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
                    class="q-mr-sm"
                    size="12px"
                    flat
                    dense
                    round
                    icon="area_chart"
                    :color="isRelativeChartShown ? 'blue-8' : 'grey-7'"
                    @click="onToggleRelativeChart"
                >
                    <q-tooltip>{{
                        isRelativeChartShown
                            ? 'Hide Relative Chart'
                            : 'Show Relative Chart'
                    }}</q-tooltip>
                </q-btn>
                <q-btn
                    class="q-mr-sm"
                    size="12px"
                    flat
                    dense
                    round
                    icon="menu"
                    color="grey-7"
                    @click="onMenuButtonClick"
                >
                    <!-- Cell Attributes Dialog -->
                    <q-dialog v-model="cellPlotDialogOpen">
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
                                        :dark="globalSettings.darkMode"
                                        menu-anchor="top left"
                                        menu-self="bottom left"
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
                                            color="primary"
                                        />
                                        <l-btn
                                            label="Cancel"
                                            flat
                                            @click="onMenuButtonClick"
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                            color="primary"
                                        />
                                    </div>
                                </q-form>
                            </q-card-section>
                        </q-card>
                    </q-dialog>

                    <!-- Track Attributes Dialog -->
                    <q-dialog v-model="trackPlotDialogOpen">
                        <q-card
                            :dark="globalSettings.darkMode"
                            style="width: 600px; max-width: 80vw"
                        >
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
                                        label="Select Aggregation"
                                        :options="aggregationOptions"
                                        option-value="label"
                                        option-label="label"
                                        v-model="aggModel"
                                        :dark="globalSettings.darkMode"
                                        emit-value
                                        clickable
                                        @update:model-value="onChangeAgg"
                                    >
                                    </q-select>
                                    <div
                                        class="text-caption q-mt-sm"
                                        v-if="currAgg?.description"
                                    >
                                        {{ currAgg.description }}
                                    </div>
                                    <q-select
                                        v-if="
                                            currAggSelections &&
                                            currAggSelections.attr1
                                        "
                                        :label="currAggSelections.attr1.label"
                                        :options="allAttributeNames"
                                        v-model="attr1Model"
                                        :dark="globalSettings.darkMode"
                                        clickable
                                    >
                                    </q-select>
                                    <q-input
                                        v-if="
                                            currAggSelections &&
                                            currAggSelections.var1 &&
                                            currAggSelections.var1.type &&
                                            currAggSelections.var1.type ===
                                                'numerical'
                                        "
                                        filled
                                        type="number"
                                        :step="currAggSelections.var1.step"
                                        v-model.number="var1Model"
                                        :label="currAggSelections.var1.label"
                                        lazy-rules
                                        :dark="globalSettings.darkMode"
                                        :min="currAggSelections.var1.min"
                                        :max="currAggSelections.var1.max"
                                    >
                                    </q-input>
                                    <q-select
                                        v-if="
                                            currAggSelections &&
                                            currAggSelections.attr2 &&
                                            currAggSelections.attr2.type &&
                                            currAggSelections.attr2.type ===
                                                'existing_attribute'
                                        "
                                        :label="currAggSelections.attr2.label"
                                        :options="allAttributeNames"
                                        v-model="attr2Model"
                                        :dark="globalSettings.darkMode"
                                        clickable
                                    >
                                    </q-select>

                                    <div>
                                        <l-btn
                                            label="Add"
                                            @click="addTrackPlotFromMenu()"
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                            color="primary"
                                        />
                                        <l-btn
                                            label="Cancel"
                                            flat
                                            @click="onMenuButtonClick"
                                            :dark="globalSettings.darkMode"
                                            class="q-mr-sm"
                                            color="primary"
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

<style scoped></style>
