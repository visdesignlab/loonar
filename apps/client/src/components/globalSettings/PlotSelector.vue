<template>
    <div>
        <div v-show="loading" class="loading-wrapper">
            <div class="loading-text">Loading...</div>
        </div>
        <div v-show="!loading">
            <div class="q-item-section__right">
                <q-btn
                    class="gt-xs q-mr-sm"
                    size="12px"
                    flat
                    dense
                    round
                    icon="menu"
                    color="grey-7"
                >
                    <q-menu v-model="menuOpen" fit>
                        <q-list
                            style="min-width: 100px; max-height: 300px"
                            class="scroll"
                        >
                            <q-item
                                v-for="name in allPlotNames"
                                :key="name"
                                clickable
                                :class="{
                                    'selected-item': isPlotSelected(name),
                                }"
                                @click.stop="togglePlotSelection(name)"
                            >
                                <q-item-section class="plot-name">{{
                                    name
                                }}</q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
                <q-btn
                    class="gt-xs"
                    size="12px"
                    flat
                    dense
                    round
                    icon="filter_alt"
                    color="grey-7"
                    @click="addFilter"
                />
            </div>
            <UnivariateCellPlot
                v-for="plot in selectedPlots"
                :key="plot.plotName"
                :plot-name="plot.plotName"
                :plot-brush="plotBrush"
                @selection-change="handleSelectionChange"
                @plot-loaded="handlePlotLoaded"
            />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { QBtn } from 'quasar';
import * as vg from '@uwdata/vgplot';
import { storeToRefs } from 'pinia';
import UnivariateCellPlot from './UnivariateCellPlot.vue';
import { useFilterStore } from '@/stores/filterStore';
import { useSelectionStore } from '@/stores/selectionStore';

interface Selections {
    [key: string]: [number, number] | undefined;
}
interface SelectionChangeEvent {
    plotName: string;
    range: [number, number] | null;
}

const menuOpen = ref(false);
const loading = ref(true);
const loadedPlots = ref(0);
const totalPlots = ref(0);

const allPlotNames = ['A', 'x', 'y', 'mass', 'time', 'MI'];
const currentSelections = ref<Selections>({});
const filterStore = useFilterStore();
const selectionStore = useSelectionStore();

const { Plots, Selections } = storeToRefs(selectionStore);

onMounted(() => {
    selectionStore.addPlot({ plotName: 'mass' });
    selectionStore.addPlot({ plotName: 'time' });
    totalPlots.value = selectedPlots.value.length;
});

const handlePlotLoaded = () => {
    loadedPlots.value++;
    console.log('Plot loaded');
    if (loadedPlots.value === totalPlots.value) {
        loading.value = false;
    }
};

const selectedPlots = computed(() => Plots.value);

const isPlotSelected = (name: string) => {
    return Plots.value.some((plot) => plot.plotName === name);
};

const mosaicSelection = computed(() => vg.Selection.intersect());

const plotBrush = computed(() => {
    console.log('plotBrush computed');

    for (let selection of Selections.value) {
        const source = selection.plotName;
        const min = +selection.range[0];
        const max = +selection.range[1];
        const value = [min, max];
        const predicate = `${source} BETWEEN ${min} AND ${max}`;
        const clause = { source, value, predicate };
        mosaicSelection.value.update(clause);
    }

    return mosaicSelection.value;
});

const togglePlotSelection = (name: string) => {
    if (isPlotSelected(name)) {
        clearSelectionForPlot(name);
        selectionStore.Plots = Plots.value.filter(
            (plot) => plot.plotName !== name
        );
        console.log(`Plot ${name} removed`);
    } else {
        selectionStore.addPlot({ plotName: name });
        console.log(`Plot ${name} added`);
    }
    console.log(
        'Current selected plots:',
        Plots.value.map((plot) => plot.plotName)
    );
};

const clearSelectionForPlot = (plotName: string) => {
    delete currentSelections.value[plotName];
    selectionStore.removeSelectionByPlotName(plotName);

    mosaicSelection.value.update({
        source: plotName,
        value: null,
        predicate: null,
    });
};

const handleSelectionRemoved = (event: CustomEvent) => {
    console.log('handleSelectionRemoved reached');
    mosaicSelection.value.update({
        source: event.detail,
        value: null,
        predicate: null,
    });
};

window.addEventListener(
    'selectionRemoved',
    handleSelectionRemoved as EventListener
);

const handleSelectionChange = (event: SelectionChangeEvent) => {
    const { plotName, range } = event;
    if (range && range[0] !== undefined && range[1] !== undefined) {
        currentSelections.value[plotName] = range;
        selectionStore.updateSelection(plotName, [
            range[0].toFixed(2),
            range[1].toFixed(2),
        ]);
    } else {
        delete currentSelections.value[plotName];
        selectionStore.removeSelectionByPlotName(plotName);
    }
};

const addFilter = () => {
    Object.entries(currentSelections.value).forEach(([plotName, range]) => {
        if (range) {
            filterStore.addFilter({
                plotName,
                range: [range[0].toFixed(2), range[1].toFixed(2)],
            });
        }
    });
};
</script>

<style scoped>
.q-item-section__right {
    display: flex;
    justify-content: flex-end;
}

.plot-name {
    font-size: 0.8em;
}

.selected-item {
    background-color: #e0e0e0;
    color: black;
}

.loading-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}

.loading-text {
    font-size: 1rem;
}
</style>
