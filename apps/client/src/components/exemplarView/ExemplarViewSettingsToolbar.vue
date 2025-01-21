<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { storeToRefs } from 'pinia';
import {
    QBtn,
    QDialog,
    QCard,
    QCardSection,
    QSelect,
    QForm,
    QSeparator,
} from 'quasar';
import LBtn from '../custom/LBtn.vue';
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(
    datasetSelectionStore
);
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
const exemplarViewStore = useExemplarViewStore();
const globalSettings = useGlobalSettings();

// New reactive constants for dialog state and selections
const plotDialogOpen = ref(false);
const selectedAttribute = ref('');
const selectedAggregation = ref('');

const aggregationOptions = [
    { label: 'Sum', value: 'SUM' },
    { label: 'Average', value: 'AVG' },
    { label: 'Count', value: 'COUNT' },
    { label: 'Minimum', value: 'MIN' },
    { label: 'Maximum', value: 'MAX' },
    { label: 'Median', value: 'MEDIAN' },
];

const emptyFunction = () => {
    // Empty function when 'Add' is clicked
};

// Function to handle dialog toggle
function onMenuButtonClick() {
    plotDialogOpen.value = !plotDialogOpen.value;
}

// Function to handle 'Add' button click
function addPlot() {
    emptyFunction();
    plotDialogOpen.value = false;
}
</script>

<template>
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
        <!-- Plot Attributes Dialog -->
        <q-dialog v-model="plotDialogOpen" persistent>
            <q-card :dark="globalSettings.darkMode">
                <q-card-section>
                    <div class="text-h6">Add Track Attribute to Display</div>
                    <q-separator class="q-my-sm" />
                    <q-form class="q-gutter-md" :dark="globalSettings.darkMode">
                        <q-select
                            label="Select Attribute"
                            :options="allAttributeNames"
                            v-model="selectedAttribute"
                            :dark="globalSettings.darkMode"
                            clickable
                        >
                        </q-select>

                        <q-select
                            label="Select Aggregation"
                            :options="aggregationOptions"
                            v-model="selectedAggregation"
                            :dark="globalSettings.darkMode"
                            clickable
                        >
                        </q-select>

                        <div>
                            <l-btn
                                label="Add"
                                @click="addPlot"
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
</template>

<style scoped lang="scss"></style>
