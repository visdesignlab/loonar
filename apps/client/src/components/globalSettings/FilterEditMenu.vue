<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGlobalSettings } from '@/stores/globalSettings';
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
import { useSelectionStore } from '@/stores/selectionStore';
import { useFilterStore } from '@/stores/filterStore';

const globalSettings = useGlobalSettings();
const props = defineProps<{
    plotName: string;
    initialMin: number;
    initialMax: number;
    type: 'selection' | 'filter';
}>();

const emit = defineEmits(['update:range']);

const selectionStore = useSelectionStore();
const filterStore = useFilterStore();

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

    if (props.type === 'selection') {
        selectionStore.updateSelection(props.plotName, newRange);
    } else if (props.type === 'filter') {
        filterStore.updateFilter(props.plotName, newRange);
    }

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
            @click="openRangeDialog"
            :dark="globalSettings.darkMode"
        >
            <q-item-section :dark="globalSettings.darkMode"
                >Enter Range</q-item-section
            >
        </q-item>
    </q-menu>

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
                        >{{ minMaxFormError }}
                        :dark="globalSettings.darkMode"
                    </q-banner>

                    <div>
                        <q-btn
                            label="Submit"
                            type="submit"
                            color="primary"
                            :disable="!minMaxFormValid"
                            :dark="globalSettings.darkMode"
                        />
                        <q-btn
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
@/stores/charts/filterStore @/stores/userInteraction/selectionStore
@/stores/componentStores/globalSettings
