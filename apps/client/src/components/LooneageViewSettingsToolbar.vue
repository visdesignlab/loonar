<script setup lang="ts">
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const looneageViewStore = useLooneageViewStore();
const eventBusStore = useEventBusStore();
</script>

<template>
    <template v-if="cellMetaData.dataInitialized">
        <q-btn
            round
            flat
            @click="eventBusStore.emitter.emit('resetLooneageView')"
            icon="center_focus_strong"
            title="reset view"
        />
        <q-badge class="q-ml-sm" outline :color="globalSettings.normalizedBlack"
            >Height:</q-badge
        >
        <q-slider
            v-model="looneageViewStore.rowHeight"
            :min="4"
            :max="240"
            label
            :dark="globalSettings.darkMode"
            class="q-ml-md max-w-150"
            switch-label-side
        />
    </template>
</template>

<style scoped lang="scss">
.max-w-150 {
    max-width: 150px;
}
.min-w-75 {
    min-width: 75px;
}
</style>
@/stores/misc/eventBusStore @/stores/charts/looneageViewStore
@/stores/componentStores/globalSettings @/stores/dataStores/cellMetaData
