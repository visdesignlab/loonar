<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { storeToRefs } from 'pinia';
import // QBtn, // Removed as it's no longer needed
// QDialog, // Removed as it's no longer needed
// QCard,
// QCardSection,
// QSelect, // Imported below
// QForm,
// QSeparator,
'quasar';
import LBtn from '../custom/LBtn.vue';

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(
    datasetSelectionStore
);

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

// Removed plotDialogOpen as the dialog is no longer used
// const plotDialogOpen = ref(false);
const selectedAttribute = ref('Mass (pg)');
const selectedAggregation = ref('AVG');

const aggregationOptions = [
    { label: 'Sum', value: 'SUM' },
    { label: 'Average', value: 'AVG' },
    { label: 'Count', value: 'COUNT' },
    { label: 'Minimum', value: 'MIN' },
    { label: 'Maximum', value: 'MAX' },
    { label: 'Median', value: 'MEDIAN' },
];

// Removed emptyFunction as it's no longer needed
// const emptyFunction = () => {
//     // Empty function when 'Add' is clicked
// };

// Removed onMenuButtonClick function
// function onMenuButtonClick() {
//     plotDialogOpen.value = !plotDialogOpen.value;
// }

// Updated addPlot function to be called on selection change
function applySelections() {
    if (selectedAttribute.value && selectedAggregation.value) {
        exemplarViewStore.selectedAttribute = selectedAttribute.value;
        exemplarViewStore.selectedAggregation = selectedAggregation.value;
        console.log(
            `Selected Attribute: ${selectedAttribute.value}, Aggregation: ${selectedAggregation.value}`
        );
        exemplarViewStore.getHistogramData();
    } else {
        console.warn('Attribute or Aggregation not selected.');
    }
    // No need to close dialog
}
</script>

<template>
    <div class="settings-toolbar">
        <q-select
            label="Aggregation"
            :options="aggregationOptions"
            v-model="selectedAggregation"
            :dark="globalSettings.darkMode"
            @update:model-value="applySelections"
            class="aggregation-select q-mr-sm"
        ></q-select>

        <q-select
            label="Attribute"
            :options="allAttributeNames"
            v-model="selectedAttribute"
            :dark="globalSettings.darkMode"
            @update:model-value="applySelections"
            class="q-mr-sm"
        ></q-select>
    </div>
</template>

<style scoped lang="scss">
.settings-toolbar {
    display: flex;
    align-items: center;
    .aggregation-select {
        min-width: 120px; // Reduced width to better fit the label
    }
}
</style>
