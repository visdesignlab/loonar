<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';

const cellMetaData = useCellMetaData();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const { sizeT } = storeToRefs(imageViewerStoreUntrracked);

const cellsCount = computed(() =>
    cellMetaData.cellArray
        ? cellMetaData.cellArray.length.toLocaleString()
        : '—'
);
const tracksCount = computed(() =>
    cellMetaData.trackArray
        ? cellMetaData.trackArray.length.toLocaleString()
        : '—'
);
const lineagesCount = computed(() =>
    (cellMetaData.lineageArray
        ? cellMetaData.lineageArray.filter((l) => l.founder.children.length > 0)
              .length
        : null) !== null
        ? cellMetaData
              .lineageArray!.filter((l) => l.founder.children.length > 0)
              .length.toLocaleString()
        : '—'
);
const imagesCount = computed(() =>
    sizeT.value != null ? sizeT.value.toLocaleString() : '—'
);
</script>

<template>
    <div class="basic-info-counts q-gutter-sm row items-center">
        <span class="text-caption"
            >Cells: <strong>{{ cellsCount }}</strong></span
        >
        <span class="text-caption"
            >Tracks: <strong>{{ tracksCount }}</strong></span
        >
        <span class="text-caption"
            >Lineages: <strong>{{ lineagesCount }}</strong></span
        >
        <span class="text-caption"
            >Images: <strong>{{ imagesCount }}</strong></span
        >
    </div>
</template>

<style scoped lang="scss">
.basic-info-counts {
    gap: 12px;
    white-space: nowrap;
    .text-caption {
        color: var(--q-color-dark, #444);
    }
    strong {
        margin-left: 4px;
    }
}
</style>
