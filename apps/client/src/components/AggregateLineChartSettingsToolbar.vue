<script setup lang="ts">
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useAggregateLineChartStore } from '@/stores/componentStores/aggregateLineChartStore';
import { matFileDownload } from '@quasar/extras/material-icons'
import { downloadLineChartSvg } from '@/util/downloadSvg';


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
    <q-btn 
    round
    flat
    :icon="matFileDownload" 
    @click="downloadLineChartSvg" />
</template>

<style scoped lang="scss">
.min-w-75 {
    min-width: 75px;
}
</style>
