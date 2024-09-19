<script setup lang="ts">
import { computed } from 'vue';
import {
    useCellMetaData,
    type Lineage,
} from '@/stores/dataStores/cellMetaDataStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { storeToRefs } from 'pinia';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();

const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const { sizeT } = storeToRefs(imageViewerStoreUntrracked);

interface DisplayInfo {
    label: string;
    value: string;
}

const displayList = computed<DisplayInfo[]>(() => {
    const info: DisplayInfo[] = [
        {
            label: 'Cells',
            value: cellMetaData.cellArray?.length.toLocaleString() ?? 'UNKNOWN',
        },
        {
            label: 'Tracks',
            value:
                cellMetaData.trackArray?.length.toLocaleString() ?? 'UNKNOWN',
        },
        {
            label: 'Lineages',
            value:
                cellMetaData.lineageArray
                    ?.filter((lineage: Lineage) => {
                        return lineage.founder.children.length > 0;
                    })
                    .length.toLocaleString() ?? 'UNKNOWN',
        },
        {
            label: 'Images',
            value: sizeT.value.toLocaleString() ?? 'UNKNOWN',
        },
    ];
    return info;
});
</script>

<template>
    <NoDataSplash></NoDataSplash>
    <div
        v-if="cellMetaData.dataInitialized"
        class="flex items-center justify-center align-center h-100"
    >
        <q-card
            v-for="info in displayList"
            :key="info.label"
            bordered
            :dark="globalSettings.darkMode"
            class="q-ma-sm inner-card"
        >
            <q-card-section>
                <div class="text-overline text-center">{{ info.label }}</div>
            </q-card-section>

            <q-card-section class="text-center text-h4 q-pt-none">
                {{ info.value }}
            </q-card-section>
        </q-card>
    </div>
</template>

<style scoped lang="scss">
.inner-card {
    border-radius: 30px;
}
</style>
@/stores/userInteraction/imageViewerStoreUntrracked
@/stores/componentStores/globalSettings @/stores/dataStores/cellMetaData
