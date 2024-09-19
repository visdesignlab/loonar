<script setup lang="ts">
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
</script>

<template>
    <q-banner
        v-if="!cellMetaData.dataInitialized"
        rounded
        :class="globalSettings.darkMode ? 'm-3 bg-grey-9' : 'm-3 bg-grey-3'"
        >Select dataset to visualize.</q-banner
    >
</template>
@/stores/componentStores/globalSettings @/stores/dataStores/cellMetaData
