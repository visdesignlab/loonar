<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import PlotSelector from './PlotSelector.vue';
import { useSelectionStore, type DataSelection } from '@/stores/interactionStores/selectionStore';
import { storeToRefs } from 'pinia';
import FilterEditMenu from './FilterEditMenu.vue';
import { stringToKeys} from '@/util/conChartStringFunctions';
import type { SelectionType } from '@/stores/interactionStores/selectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

const globalSettings = useGlobalSettings();
const selectionStore = useSelectionStore();
const { dataFilters, dataSelections } = storeToRefs(selectionStore);
const conditionSelectorStore = useConditionSelectorStore();
const { xLabels, yLabels, selectedXTag, selectedYTag, selectedGrid } =
    storeToRefs(conditionSelectorStore);

const selectionsCount = computed(() => dataSelections.value.length);

function removeFilter(plotName: string) {
    console.log(plotName);
    selectionStore.removeFilterByPlotName(plotName);
}
function removeSelection(plotName: string) {
    selectionStore.removeSelectionByPlotName(plotName);
}
function convertToFilters() {
    selectionStore.convertToFilters();    
}

const cellAttributesOpen = ref(true);
const trackAttributesOpen = ref(true);

const mutedTextClass = computed(() =>
    globalSettings.darkMode ? 'text-grey-5' : 'text-grey-8'
);

// Just for additional styling of existing filters.
interface ReadableDataFilter{
    plotName:string,
    type:SelectionType,
    range:[number,number];
    subName?:string
}

const readableDataFilters = computed(() => {
    const nonConditionChartFilters = dataFilters.value.filter(entry => entry.type !== 'conditionChart');
    const conditionChartLength = dataFilters.value.filter(entry => entry.type === 'conditionChart').length;
    const totalLength = xLabels.value.length*yLabels.value.length;
    if(totalLength === conditionChartLength){
        return nonConditionChartFilters as ReadableDataFilter[];
    } else {
        return [...nonConditionChartFilters, {
        plotName:`Condition Charts`,
        subName: `${conditionChartLength} out of ${xLabels.value.length*yLabels.value.length} selected.`,
        type:'conditionChart' as SelectionType,
        range:[0,0]
        }] as ReadableDataFilter[]
    }
})

const filtersCount = computed(() => readableDataFilters.value.length);


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
                    ) in selectionStore.dataSelections"
                    :key="index"
                >
                    <FilterEditMenu
                        :plot-name="selection.plotName"
                        :initial-min="selection.range[0]"
                        :initial-max="selection.range[1]"
                        filterType="selection"
                        :attributeType="selection.type"
                    />

                    <q-item-section
                        side
                        left
                        class="q-pa-none q-mr-xs flex-grow-0"
                    >
                        <q-avatar
                            :icon="
                                selection.type === 'cell'
                                    ? 'scatter_plot'
                                    : 'linear_scale'
                            "
                        />
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
            @click="convertToFilters"
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
                <q-item v-for="(filter, index) in readableDataFilters" :key="index">
                    <FilterEditMenu
                        :plot-name="filter.plotName"
                        :initial-min="filter.range[0]"
                        :initial-max="filter.range[1]"
                        filterType="filter"
                        :attributeType="filter.type"
                    />

                    <q-item-section
                        side
                        left
                        class="q-pa-none q-mr-xs flex-grow-0"
                    >
                        <q-avatar
                            :icon="
                                filter.type === 'cell'
                                    ? 'scatter_plot'
                                    : 'linear_scale'
                            "
                        />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label class="text-body2">
                            {{ filter.plotName }}
                            <div class="text-caption">{{ filter.subName }}</div>
                        </q-item-label>
                        <q-item-label
                            v-if="filter.type !== 'conditionChart'"
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
                            @click="removeFilter(filter.plotName)"
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
                <PlotSelector selector-type="cell"></PlotSelector>
            </q-card>
        </q-expansion-item>

        <q-separator class="q-my-sm" />

        <q-expansion-item
            v-model="trackAttributesOpen"
            icon="linear_scale"
            label="Track Attributes"
        >
            <q-card :dark="globalSettings.darkMode">
                <PlotSelector selector-type="track"></PlotSelector>
            </q-card>
        </q-expansion-item>
    </q-list>
</template>

<style scoped lange="scss"></style>
