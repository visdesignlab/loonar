<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCellMetaData, type Lineage } from '@/stores/cellMetaData';
import { useGlobalSettings } from '@/stores/globalSettings';
import { useElementSize } from '@vueuse/core';
import NoDataSplash from './NoDataSplash.vue';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const props = defineProps<{ attributeLevel: 'cell' | 'track' | 'lineage' }>();

const headers = computed(() => {
    switch (props.attributeLevel) {
        case 'cell':
            return cellMetaData.cellAttributeHeaders;
        case 'track':
            return cellMetaData.trackAttributeHeaders;
        case 'lineage':
            return cellMetaData.lineageAttributeHeaders;
    }
    return [];
});

const items = computed(() => {
    switch (props.attributeLevel) {
        case 'cell':
            return cellMetaData.selectedTrack?.cells ?? cellMetaData.cellArray;
        case 'track':
            if (cellMetaData.selectedTrack) return [cellMetaData.selectedTrack];
            return cellMetaData.trackArray;
        case 'lineage':
            return cellMetaData.lineageArray;
    }
    return [];
});

const selection = computed<Lineage[]>({
    get() {
        if (cellMetaData.selectedLineage == null) return [];
        return [cellMetaData.selectedLineage as Lineage];
    },
    set(val) {
        if (props.attributeLevel == 'lineage') {
            cellMetaData.selectLineage(val[0] as Lineage);
        }
    },
});

const tableContainer = ref(null);
const { width: _containerWidth, height: containerHeight } =
    useElementSize(tableContainer);
const initialPagination = ref({
    page: 1,
    rowsPerPage: 25,
});
const rowsPerPageOptions = ref([5, 25, 50, 100]);
</script>
<template>
    <div ref="tableContainer" class="aardvark-table-wrapper">
        <q-table
            v-if="cellMetaData.dataInitialized"
            class="sticky-column-table"
            :rows="items"
            :columns="headers as any"
            row-key="lineageId"
            :selection="props.attributeLevel === 'lineage' ? 'single' : 'none'"
            v-model:selected="selection"
            :dark="globalSettings.darkMode"
            flat
            dense
            :style="`max-height: ${containerHeight}px`"
            :pagination="initialPagination"
            :rows-per-page-options="rowsPerPageOptions"
        ></q-table>
        <no-data-splash></no-data-splash>
    </div>
</template>

<style lang="scss">
// Modified from: https://quasar.dev/vue-components/table#sticky-header-column

.aardvark-table-wrapper {
    height: 100%;
}

.sticky-column-table td:first-child {
    background-color: white !important;
}

.q-dark td:first-child {
    background-color: var(--q-dark) !important;
}

.sticky-column-table tr th {
    position: sticky;
    /* higher than z-index for td below */
    z-index: 2;
    background: white;
}

.q-dark tr th {
    background-color: var(--q-dark) !important;
}

/* this will be the loading indicator */
.sticky-column-table thead tr:last-child th {
    /* height of all previous header rows */
    top: 48px;
    /* highest z-index */
    z-index: 3;
}
.sticky-column-table thead tr:first-child th {
    top: 0;
    z-index: 1;
}
.sticky-column-table tr:first-child th:first-child {
    /* highest z-index */
    z-index: 3;
}

.sticky-column-table td:first-child {
    z-index: 1;
    border-width: 0 2px 0 0;
}

.sticky-column-table td:first-child,
th:first-child {
    position: sticky;
    left: 0;
}
</style>
@/stores/componentStores/globalSettings @/stores/dataStores/cellMetaData
