<script setup lang="ts">
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useAggregateLineChartStore } from '@/stores/componentStores/aggregateLineChartStore';
const cellMetaData = useCellMetaData();
const aggregateLineChartStore = useAggregateLineChartStore();
const globalSettings = useGlobalSettings();
</script>

<template>
    <q-select
        label="Attribute"
        class="min-w-75"
        dense
        v-model="aggregateLineChartStore.attributeKey"
        :options="cellMetaData.cellNumAttributeHeaderNames"
        :dark="globalSettings.darkMode"
    ></q-select>
</template>

<style scoped lang="scss">
.min-w-75 {
    min-width: 75px;
}
</style>
@/stores/charts/aggregateLineChartStore @/stores/componentStores/globalSettings
@/stores/dataStores/cellMetaData
