<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';

const cellMetaData = useCellMetaData();
const { selectedLineage, selectedTrack } = storeToRefs(cellMetaData);
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const { sizeT } = storeToRefs(imageViewerStoreUntrracked);

const cellsCount = computed(() => {
    const total = cellMetaData.cellArray
        ? cellMetaData.cellArray.length.toLocaleString()
        : '—';
    
    if (selectedLineage.value) {
        let count = 0;
        const iterator = cellMetaData.makeLineageCellIterator(selectedLineage.value.founder);
        for (const _ of iterator) {
            count++;
        }
        return `${count.toLocaleString()} / ${total}`;
    } else if (selectedTrack.value) {
        return `${selectedTrack.value.cells.length.toLocaleString()} / ${total}`;
    }
    
    return total;
});

const tracksCount = computed(() => {
    const total = cellMetaData.trackArray
        ? cellMetaData.trackArray.length.toLocaleString()
        : '—';

    if (selectedLineage.value) {
        let count = 0;
        const iterator = cellMetaData.makeLineageTrackIterator(selectedLineage.value.founder);
        for (const _ of iterator) {
            count++;
        }
        return `${count.toLocaleString()} / ${total}`;
    } else if (selectedTrack.value) {
        return `1 / ${total}`;
    }

    return total;
});

const lineagesCount = computed(() => {
    const total = (cellMetaData.lineageArray
        ? cellMetaData.lineageArray.filter((l) => l.founder.children.length > 0)
              .length
        : null) !== null
        ? cellMetaData
              .lineageArray!.filter((l) => l.founder.children.length > 0)
              .length.toLocaleString()
        : '—';

    if (selectedLineage.value) {
        return `1 / ${total}`;
    } else if (selectedTrack.value) {
        return `1 / ${total}`;
    }

    return total;
});

const imagesCount = computed(() => {
    const total = sizeT.value != null ? sizeT.value.toLocaleString() : '—';

    if (selectedLineage.value) {
        const frames = new Set<number>();
        const iterator = cellMetaData.makeLineageCellIterator(selectedLineage.value.founder);
        for (const cell of iterator) {
            frames.add(cellMetaData.getFrame(cell));
        }
        return `${frames.size.toLocaleString()} / ${total}`;
    } else if (selectedTrack.value) {
        const frames = new Set<number>();
        for (const cell of selectedTrack.value.cells) {
            frames.add(cellMetaData.getFrame(cell));
        }
        return `${frames.size.toLocaleString()} / ${total}`;
    }

    return total;
});

const hasSelection = computed(() => {
    return !!selectedLineage.value || !!selectedTrack.value;
});
</script>

<template>
    <div
        class="basic-info-counts q-gutter-sm row items-center"
        style="margin-right: 30px"
    >
        <span class="text-caption" :class="{ 'text-primary': hasSelection }"
            >Cells: <strong>{{ cellsCount }}</strong></span
        >
        <span class="text-caption" :class="{ 'text-primary': hasSelection }"
            >Tracks: <strong>{{ tracksCount }}</strong></span
        >
        <span class="text-caption" :class="{ 'text-primary': hasSelection }"
            >Lineages: <strong>{{ lineagesCount }}</strong></span
        >
        <span class="text-caption" :class="{ 'text-primary': hasSelection }"
            >Images: <strong>{{ imagesCount }}</strong></span
        >
        <span class="divider"> | </span>
    </div>
</template>

<style scoped lang="scss">
.basic-info-counts {
    gap: 12px;
    white-space: nowrap;
    .text-caption {
        color: var(--q-color-dark, #444);
        &.text-primary {
            color: var(--q-primary);
        }
    }
    strong {
        margin-left: 4px;
    }
}

/* lighter divider that works in dark & light themes */
.divider {
    opacity: 0.3;
    margin-left: 6px;
    margin-right: 6px;
}
</style>
