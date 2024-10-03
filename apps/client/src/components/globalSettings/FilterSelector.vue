<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import PlotSelector from './PlotSelector.vue';
import { useFilterStore } from '@/stores/componentStores/filterStore';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { storeToRefs } from 'pinia';
import FilterEditMenu from './FilterEditMenu.vue';

const globalSettings = useGlobalSettings();
const filterStore = useFilterStore();
const selectionStore = useSelectionStore();
const { filters } = storeToRefs(filterStore);

const selectionsCount = computed(
    () => selectionStore.modifiedSelections.length
);
const filtersCount = computed(() => filters.value.length);

function removeFilter(index: number) {
    filterStore.removeFilter(index);
}
function removeSelection(plotName: string) {
    selectionStore.removeSelectionByPlotName(plotName);
}
function addFilter() {
    for (const selection of selectionStore.modifiedSelections) {
        filterStore.addFilter({
            plotName: selection.plotName,
            range: [selection.range[0], selection.range[1]],
        });
    }
}

const cellAttributesOpen = ref(true);

const mutedTextClass = computed(() =>
    globalSettings.darkMode ? 'text-grey-5' : 'text-grey-8'
);
</script>

<template>
    <q-list bordered class="q-mb-md">
        <q-expansion-item>
            <template v-slot:header>
                <q-item-section> Selections </q-item-section>
                <q-item-section side>
                    <q-chip
                        size="md"
                        square
                        dense
                        color="grey-3"
                        text-color="black"
                    >
                        {{ selectionsCount ? selectionsCount : 'None' }}
                    </q-chip>
                </q-item-section>
            </template>
            <q-list>
                <q-item
                    v-for="(
                        selection, index
                    ) in selectionStore.modifiedSelections"
                    :key="index"
                >
                    <FilterEditMenu
                        :plot-name="selection.plotName"
                        :initial-min="selection.range[0]"
                        :initial-max="selection.range[1]"
                        type="selection"
                    />

                    <q-item-section
                        side
                        left
                        class="q-pa-none q-mr-xs flex-grow-0"
                    >
                        <q-avatar icon="scatter_plot" />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label class="text-body2">
                            {{ selection.plotName }}
                        </q-item-label>
                        <q-item-label
                            :class="`text-caption ${mutedTextClass}`"
                            :dark="globalSettings.darkMode"
                        >
                            {{ selection.range[0].toFixed(2) }} –
                            {{ selection.range[1].toFixed(2) }}
                        </q-item-label>
                    </q-item-section>

                    <q-item-section side>
                        <q-btn
                            class="gt-xs"
                            @click="removeSelection(selection.plotName)"
                            size="md"
                            flat
                            dense
                            round
                            icon="delete"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-expansion-item>
        <q-separator />
        <q-btn
            flat
            icon="arrow_downward"
            icon-right="arrow_downward"
            label="Convert to Filters"
            no-caps
            class="filter-style w-100"
            dense
            @click="addFilter"
        />
        <q-separator />
        <q-expansion-item>
            <template v-slot:header>
                <q-item-section>Filters</q-item-section>
                <q-item-section side>
                    <q-chip
                        size="md"
                        square
                        dense
                        color="grey-3"
                        text-color="black"
                    >
                        {{ filtersCount ? filtersCount : 'None' }}
                    </q-chip>
                </q-item-section>
            </template>
            <q-list>
                <q-item v-for="(filter, index) in filters" :key="index">
                    <FilterEditMenu
                        :plot-name="filter.plotName"
                        :initial-min="filter.range[0]"
                        :initial-max="filter.range[1]"
                        type="filter"
                    />

                    <q-item-section
                        side
                        left
                        class="q-pa-none q-mr-xs flex-grow-0"
                    >
                        <q-avatar icon="scatter_plot" />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label class="text-body2">
                            {{ filter.plotName }}
                        </q-item-label>
                        <q-item-label
                            :class="`text-caption ${mutedTextClass}`"
                            :dark="globalSettings.darkMode"
                        >
                            {{ filter.range[0].toFixed(2) }} –
                            {{ filter.range[1].toFixed(2) }}
                        </q-item-label>
                    </q-item-section>

                    <q-item-section side>
                        <q-btn
                            class="gt-xs"
                            @click="removeFilter(index)"
                            size="md"
                            flat
                            dense
                            round
                            icon="delete"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-expansion-item>
    </q-list>
    <q-list>
        <q-expansion-item
            v-model="cellAttributesOpen"
            icon="scatter_plot"
            label="Cell Attributes"
        >
            <q-card :dark="globalSettings.darkMode">
                <PlotSelector></PlotSelector>
            </q-card>
        </q-expansion-item>

        <q-separator />
    </q-list>
</template>

<style scoped lange="scss"></style>
