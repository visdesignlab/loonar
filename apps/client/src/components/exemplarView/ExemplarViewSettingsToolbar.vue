<script setup lang="ts">
import { ref, computed } from 'vue';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { storeToRefs } from 'pinia';
import { QBtn, QDialog, QCard, QCardSection, QForm, QSelect, QSeparator } from 'quasar';
import LBtn from '../custom/LBtn.vue';

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);

const allAttributeNames = computed(() => {
  return experimentDataInitialized.value && currentExperimentMetadata.value?.headers?.length
    ? currentExperimentMetadata.value.headers
    : [];
});

const exemplarViewStore = useExemplarViewStore();
const globalSettings = useGlobalSettings();

const selectedAttribute = ref('Mass (pg)');
const selectedAggregation = ref({ label: 'Average', value: 'AVG' });

const aggregationOptions = [
  { label: 'Sum',     value: 'SUM' },
  { label: 'Average', value: 'AVG' },
  { label: 'Count',   value: 'COUNT' },
  { label: 'Minimum', value: 'MIN' },
  { label: 'Maximum', value: 'MAX' },
  { label: 'Median',  value: 'MEDIAN' },
];

// dialog control
const plotDialogOpen = ref(false);

function applySelections() {
  if (selectedAttribute.value && selectedAggregation.value) {
    exemplarViewStore.selectedAttribute   = selectedAttribute.value;
    exemplarViewStore.selectedAggregation = selectedAggregation.value;
    exemplarViewStore.getHistogramData();
  } else {
    console.warn('Attribute or Aggregation not selected.');
  }
}

function onAddClick() {
  applySelections();
  plotDialogOpen.value = false;
}
</script>

<template>
  <div class="settings-toolbar">
    <q-btn
      class="q-mr-sm"
      size="12px"
      flat
      dense
      round
      icon="menu"
      color="grey-7"
      @click="plotDialogOpen = true"
    />
    <q-dialog v-model="plotDialogOpen">
      <q-card :dark="globalSettings.darkMode" style="min-width: 300px;">
        <q-card-section>
          <div class="text-h6">Change Exemplar Selection Criteria</div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <q-form class="q-gutter-md" :dark="globalSettings.darkMode">
            <q-select
              label="Select Aggregation"
              :options="aggregationOptions"
              option-label="label"
              option-value="value"
              v-model="selectedAggregation.value"
              emit-value
              map-options
            />
            <q-select
              label="Select Attribute"
              :options="allAttributeNames"
              v-model="selectedAttribute"
            />
            <div class="row justify-end q-mt-md">
              <l-btn label="Add" @click="onAddClick" color="primary" class="q-mr-sm" />
              <l-btn label="Cancel" flat @click="plotDialogOpen = false" class="q-mr-sm"
              color="primary"/>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
.settings-toolbar {
  display: flex;
  align-items: center;
}
</style>