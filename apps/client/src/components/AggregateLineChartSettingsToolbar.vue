<script setup lang="ts">
import { useCellMetaData } from '@/stores/cellMetaData';
import { useGlobalSettings } from '@/stores/globalSettings';
import { useAggregateLineChartStore } from '@/stores/aggregateLineChartStore';
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
