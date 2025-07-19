<script setup lang="ts">
import { ref, computed } from 'vue';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { storeToRefs } from 'pinia';
import {
  aggregateFunctions,
  isStandardAggregateFunction,
  type AttributeSelection,
  type AggregateFunction,
} from '@/components/plotSelector/aggregateFunctions';
import LBtn from '../custom/LBtn.vue';

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);

const allAttributeNames = computed(() => {
  return experimentDataInitialized.value && currentExperimentMetadata.value?.headers?.length
    ? [...currentExperimentMetadata.value.headers, 'Mass Norm', 'Time Norm']
    : [];
});

const exemplarViewStore = useExemplarViewStore();
const globalSettings = useGlobalSettings();

const selectedAttribute = ref(exemplarViewStore.selectedAttribute);
const selectedAggregation = ref(exemplarViewStore.selectedAggregation);

const aggModel = ref(selectedAggregation.value?.label ?? null);
const attr1Model = ref(selectedAttribute.value ?? null);
const attr2Model = ref<string | null>(null);
const var1Model = ref<number | string | null>(null);

const plotDialogOpen = ref(false);

const aggregationOptions = computed(() => {
  return Object.entries(aggregateFunctions).map((entry) => {
    return { label: entry[0] };
  });
});

const currAgg = computed<AggregateFunction | null>(() =>
  aggModel.value ? aggregateFunctions[aggModel.value] : null
);

const currAggSelections = computed(
  (): Record<string, AttributeSelection> | undefined => {
    if (!currAgg.value) return;
    if (!isStandardAggregateFunction(currAgg.value)) {
      return;
    }
    return currAgg.value.selections;
  }
);

function onChangeAgg() {
  var1Model.value = null;
  attr2Model.value = null;
  attr1Model.value = null;
}

function applySelections() {
  if (!aggModel.value) {
    console.warn('Aggregation not selected.');
    return;
  }

  const aggFunc = aggregateFunctions[aggModel.value];
  const needsAttr1 = aggFunc && 'selections' in aggFunc && aggFunc.selections?.attr1;

  // Only require attr1 if the aggregation needs it
  if (needsAttr1 && !attr1Model.value) {
    console.warn('Attribute not selected for this aggregation.');
    return;
  }

  // Always assign string values, not objects
  function getString(val: any) {
    if (val == null) return '';
    if (typeof val === 'object') {
      return val.label ?? val.value ?? '';
    }
    return String(val);
  }

  exemplarViewStore.selectedAggregation = {
    label: aggModel.value,
    value: aggregateFunctions[aggModel.value].functionName,
  };
  console.log("agg1model:", getString(attr1Model.value) );
  exemplarViewStore.selectedAttribute = getString(attr1Model.value);
  exemplarViewStore.selectedAttr2 = attr2Model.value ? getString(attr2Model.value) : null;
  exemplarViewStore.selectedVar1 = var1Model.value != null ? getString(var1Model.value) : null;

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
      <q-card :dark="globalSettings.darkMode" style="min-width: 300px; max-width: 80vw;">
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
              option-value="label"
              v-model="aggModel"
              :dark="globalSettings.darkMode"
              emit-value
              clickable
              @update:model-value="onChangeAgg"
            />
            <div
              class="text-caption q-mt-sm"
              v-if="currAgg?.description"
            >
              {{ currAgg.description }}
            </div>
            <q-select
              v-if="currAggSelections && currAggSelections.attr1"
              :label="currAggSelections.attr1.label"
              :options="allAttributeNames"
              v-model="attr1Model"
              :dark="globalSettings.darkMode"
              clickable
            />
            <q-input
              v-if="
                currAggSelections &&
                currAggSelections.var1 &&
                currAggSelections.var1?.type === 'numerical'
              "
              filled
              type="number"
              :step="currAggSelections.var1.step"
              v-model.number="var1Model"
              :label="currAggSelections.var1.label"
              lazy-rules
              :rules="[
                val => val !== null && val !== undefined && val !== '' || 'Value is required',
                val => val >= (currAggSelections.var1.min || 0) || `Value must be at least ${currAggSelections.var1.min || 0}`,
                val => val <= (currAggSelections.var1.max || 1) || `Value must be at most ${currAggSelections.var1.max || 1}`
              ]"
              :dark="globalSettings.darkMode"
              :min="currAggSelections.var1.min"
              :max="currAggSelections.var1.max"
            />
            <q-select
              v-if="
                currAggSelections &&
                currAggSelections.attr2 &&
                currAggSelections.attr2.type === 'existing_attribute'
              "
              :label="currAggSelections.attr2?.label"
              :options="allAttributeNames"
              v-model="attr2Model"
              :dark="globalSettings.darkMode"
              clickable
            />
            <q-separator class="q-my-md" />
            <q-select
              label="Exemplar Percentiles"
              :options="exemplarViewStore.percentileOptions"
              v-model="exemplarViewStore.exemplarPercentiles"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              :dark="globalSettings.darkMode"
            />
            <div class="row justify-end q-mt-md">
              <LBtn label="Add" @click="applySelections" color="primary" class="q-mr-sm" />
              <LBtn label="Cancel" flat @click="plotDialogOpen = false" color="primary"/>
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