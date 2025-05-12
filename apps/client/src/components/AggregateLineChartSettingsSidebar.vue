<script setup lang="ts">
import { computed } from 'vue';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useAggregateLineChartStore } from '@/stores/componentStores/aggregateLineChartStore';
const cellMetaData = useCellMetaData();
const aggregateLineChartStore = useAggregateLineChartStore();
const globalSettings = useGlobalSettings();

const currentKey = computed({
    get() {
        return aggregateLineChartStore.aggregatorKey;
    },
    set(val: string) {
        aggregateLineChartStore.$patch(() => {
            // patch so prov store gets one update
            // this might trigger multiple otherwise due to dependencies
            aggregateLineChartStore.aggregatorKey = val;
        });
    },
});
</script>

<template>
    <q-select
        label="show"
        v-model="aggregateLineChartStore.targetKey"
        :options="aggregateLineChartStore.targetOptions"
        :dark="globalSettings.darkMode"
    ></q-select>
    <q-select
        label="Aggregate with"
        :disable="aggregateLineChartStore.targetKey === 'cell tracks'"
        v-model="currentKey"
        :options="aggregateLineChartStore.aggregatorOptions"
        :dark="globalSettings.darkMode"
    ></q-select>
    <q-select
        label="Attribute"
        v-model="aggregateLineChartStore.attributeKey"
        :options="cellMetaData.cellNumAttributeHeaderNames"
        :dark="globalSettings.darkMode"
    ></q-select>
    <div class="row items-center q-col-gutter-lg">
        <q-input
            label="Range Min"
            class="col"
            style="max-width: 100px;"
            dense
            v-model.number="aggregateLineChartStore.customRangeMin"
            type="number"
            :dark="globalSettings.darkMode"
        />
        <q-input
            label="Range Max"
            class="col"
            style="max-width: 100px; margin-left: auto;"
            dense
            v-model.number="aggregateLineChartStore.customRangeMax"
            type="number"
            :dark="globalSettings.darkMode"
        />
    </div>
    <q-select
        label="Band"
        :disable="!aggregateLineChartStore.showVarianceBand"
        v-model="aggregateLineChartStore.varianceKey"
        :options="aggregateLineChartStore.varianceOptions"
        :dark="globalSettings.darkMode"
    ></q-select>
    <q-badge class="q-mt-md" outline :color="globalSettings.normalizedBlack"
        >Smooth:</q-badge
    >
    <q-slider
        v-model="aggregateLineChartStore.smoothWindowComputed"
        @change="aggregateLineChartStore.onSmoothWindowChange"
        :min="0"
        :max="20"
        label
        :dark="globalSettings.darkMode"
    />
</template>

<style scoped lang="scss"></style>
