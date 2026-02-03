<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { storeToRefs } from 'pinia';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';

const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const cellMetaData = useCellMetaData();
const imageViewerStore = useImageViewerStore();
const eventBusStore = useEventBusStore();
const globalSettings = useGlobalSettings();
const { sizeT } = storeToRefs(imageViewerStoreUntrracked);
</script>

<template>
    <template v-if="cellMetaData.dataInitialized">
        <q-btn
            round
            flat
            @click="eventBusStore.emitter.emit('resetImageView')"
            icon="center_focus_strong"
            title="reset view"
        />
        <q-btn-group outline rounded class="q-mr-md">
            <q-btn
                @click="imageViewerStore.stepBackwards"
                size="sm"
                outline
                round
                title="previous frame"
                icon="arrow_left"
            />
            <q-btn
                @click="() => imageViewerStore.stepForwards(sizeT - 1)"
                size="sm"
                outline
                round
                title="next frame"
                icon="arrow_right"
            />
        </q-btn-group>
        <q-slider
            class="mw-150"
            v-model="imageViewerStore.frameNumber"
            :min="1"
            :max="sizeT"
            label
            switch-label-side
            :dark="globalSettings.darkMode"
        />
        <span class="text-caption q-ml-sm no-break"
            >{{ imageViewerStore.frameNumber }} / {{ sizeT }}</span
        >
        <q-chip
            v-if="imageViewerStoreUntrracked.isImageLoading"
            dense
            size="sm"
            icon="hourglass_empty"
            label="Loading..."
            class="q-px-sm q-ml-sm"
        />
    </template>
</template>
<style scoped lang="scss">
.mw-150 {
    max-width: 150px;
}

.no-break {
    white-space: pre;
}
</style>
