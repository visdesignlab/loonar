<script setup lang="ts">
import { ref, computed } from 'vue';
import LBtn from '../custom/LBtn.vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import {
    QMenu,
    QItem,
    QItemSection,
    QDialog,
    QCard,
    QCardSection,
    QForm,
    QInput,
    QBtn,
    QBanner,
} from 'quasar';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';

import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
const mosaicSelectionStore = useMosaicSelectionStore(); // Initialize the store

const globalSettings = useGlobalSettings();
const props = defineProps<{
    plotName: string;
    initialMin: number;
    initialMax: number;
    filterType: 'selection' | 'filter';
    attributeType: string;
}>();

const emit = defineEmits(['update:range']);

const selectionStore = useSelectionStore();

// Plot Deletion -----------------
const deleteDialogOpen = ref(false);

function confirmDeletePlot() {
    deleteDialogOpen.value = true;
}
function deletePlot() {
    selectionStore.removeSelectionByPlotName(props.plotName);
    selectionStore.removeFilterByPlotName(props.plotName);
    deleteDialogOpen.value = false;
}

function cancelDelete() {
    deleteDialogOpen.value = false;
}

const showRangeDialog = ref(false);
const minInput = ref(props.initialMin);
const maxInput = ref(props.initialMax);

function openRangeDialog() {
    minInput.value = props.initialMin;
    maxInput.value = props.initialMax;
    showRangeDialog.value = true;
}

function onSubmit() {
    if (
        typeof minInput.value === 'undefined' ||
        typeof maxInput.value === 'undefined'
    )
        return;

    const newRange: [number, number] = [minInput.value, maxInput.value];

    if (props.filterType === 'selection') {
        selectionStore.updateSelection(props.plotName, newRange);
        //useMosaicSelectionStore.updateMosaicSelection();
    } else if (props.filterType === 'filter') {
        selectionStore.updateFilter(props.plotName, newRange);
    }

    // mosaicSelectionStore.updateMosaicSelection(
    //     props.plotName,
    //     newRange,
    //     'cell'
    // );

    emit('update:range', { min: newRange[0], max: newRange[1] });
    showRangeDialog.value = false;
}

const minMaxFormError = computed<string | boolean>(() => {
    // @ts-ignore: actually it can be '', I would expect quasar to make this undefined or null, but it doesn't
    if (typeof minInput.value === 'undefined' || minInput.value === '')
        return 'Min cannot be undefined.';
    // @ts-ignore: actually it can be '', I would expect quasar to make this undefined or null, but it doesn't
    if (typeof maxInput.value === 'undefined' || maxInput.value === '')
        return 'Max cannot be undefined.';
    if (minInput.value > maxInput.value)
        return 'Min should be less than or equal to Max.';
    return false;
});

const minMaxFormValid = computed<boolean>(() => {
    return !minMaxFormError.value;
});
</script>

<template>
    <q-menu touch-position context-menu :dark="globalSettings.darkMode">
        <q-item
            clickable
            v-close-popup
            @click="confirmDeletePlot"
            :dark="globalSettings.darkMode"
        >
            <q-item-section :dark="globalSettings.darkMode" class="text-red"
                >Delete</q-item-section
            >
        </q-item>
        <q-item
            clickable
            v-close-popup
            @click="openRangeDialog"
            :dark="globalSettings.darkMode"
        >
            <q-item-section :dark="globalSettings.darkMode"
                >Enter Range</q-item-section
            >
        </q-item>
    </q-menu>
    <!-- Confirmation Dialog -->
    <q-dialog v-model="deleteDialogOpen" persistent>
        <q-card :dark="globalSettings.darkMode">
            <q-card-section>
                <div class="text-h6">Delete "{{ props.plotName }}"?</div>
            </q-card-section>
            <q-card-actions align="right">
                <l-btn
                    flat
                    label="Cancel"
                    color="primary"
                    @click="cancelDelete"
                />
                <l-btn flat label="Delete" color="red" @click="deletePlot" />
            </q-card-actions>
        </q-card>
    </q-dialog>

    <q-dialog v-model="showRangeDialog">
        <q-card :dark="globalSettings.darkMode">
            <q-card-section :dark="globalSettings.darkMode">
                <div class="text-h6">Enter Range for {{ plotName }}</div>
            </q-card-section>

            <q-card-section>
                <q-form
                    @submit="onSubmit"
                    class="q-gutter-md"
                    :dark="globalSettings.darkMode"
                >
                    <q-input
                        filled
                        type="number"
                        step="any"
                        v-model.number="minInput"
                        label="Min"
                        lazy-rules
                        :dark="globalSettings.darkMode"
                    />

                    <q-input
                        filled
                        type="number"
                        step="any"
                        v-model.number="maxInput"
                        label="Max"
                        lazy-rules
                        :dark="globalSettings.darkMode"
                    />

                    <q-banner
                        v-if="minMaxFormError"
                        dense
                        class="text-white bg-red"
                        :dark="globalSettings.darkMode"
                    >
                        {{ minMaxFormError }}
                    </q-banner>

                    <div>
                        <l-btn
                            label="Submit"
                            @click="onSubmit"
                            color="primary"
                            :disable="!minMaxFormValid"
                            :dark="globalSettings.darkMode"
                        />
                        <l-btn
                            label="Cancel"
                            color="primary"
                            flat
                            @click="showRangeDialog = false"
                            class="q-ml-sm"
                            :dark="globalSettings.darkMode"
                        />
                    </div>
                </q-form>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
