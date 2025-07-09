<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import { clamp } from 'lodash-es';

import {
    schemeReds,
    schemeBlues,
    schemeGreens,
    schemeOranges,
    schemePurples,
} from 'd3-scale-chromatic';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const looneageViewStore = useLooneageViewStore();
const exemplarViewStore = useExemplarViewStore();
const eventBusStore = useEventBusStore();

const { horizonChartSettings } = storeToRefs(exemplarViewStore);
const colorSchemeOptions = [
    { label: 'Red', value: schemeReds },
    { label: 'Blue', value: schemeBlues },
    { label: 'Green', value: schemeGreens },
    { label: 'Orange', value: schemeOranges },
    { label: 'Purple', value: schemePurples },
];

const horizonSettingsModal = ref(false);

const snippetDisplaySize = computed<number>({
  get: () => exemplarViewStore.viewConfiguration.snippetDisplayHeight,
  set: (val: number) => {
    exemplarViewStore.viewConfiguration.snippetDisplayHeight = val
    exemplarViewStore.viewConfiguration.snippetDisplayWidth  = val
  }
})
</script>

<template>
    <q-btn class="q-mb-sm" @click="horizonSettingsModal = true" outline
        >Configure Horizon Charts</q-btn
    >

    <q-dialog v-model="horizonSettingsModal">
        <q-card style="min-width: 900px" :dark="globalSettings.darkMode">
            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6">Configure Horizon Charts</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section>
                <div
                    class="row no-wrap justify-center q-mb-lg"
                >
                    <q-select
                        label="Positive Colors"
                        v-model="horizonChartSettings.positiveColorScheme"
                        :options="colorSchemeOptions"
                        option-label="label"
                        option-value="label"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm min-width-130"
                    />
                    <q-select
                        label="Negative Colors"
                        v-model="horizonChartSettings.negativeColorScheme"
                        :options="colorSchemeOptions"
                        option-label="label"
                        option-value="label"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm min-width-130"
                    />
                    <q-input
                        label="Bin Size"
                        v-model.number="horizonChartSettings.modHeight"
                        type="number"
                        :dark="globalSettings.darkMode"
                        debounce="400"
                        class="q-mr-sm"
                    />
                    <q-input
                        label="Baseline"
                        v-model.number="horizonChartSettings.baseline"
                        type="number"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm"
                    />
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Done" v-close-popup />
            </q-card-actions>
        </q-card>
    </q-dialog>

    <q-toggle
        label="Show Snippet Image"
        v-model="exemplarViewStore.viewConfiguration.showSnippetImage"
        :dark="globalSettings.darkMode"
    />
    <q-toggle
        label="Show Snippet Outline"
        v-model="exemplarViewStore.viewConfiguration.showSnippetOutline"
        :dark="globalSettings.darkMode"
    />
    <q-toggle
        label="Space Snippets Evenly"
        v-model="exemplarViewStore.viewConfiguration.spaceKeyFramesEvenly"
        :dark="globalSettings.darkMode"
    />
    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Height:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="looneageViewStore.rowHeight"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.horizonChartHeight"
            :min="4"
            :max="240"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Snippet Source Size:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.snippetSourceSize"
                type="number"
                :step="2"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.snippetSourceSize"
            :min="8"
            :max="320"
            :step="2"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Snippet Display Size:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="looneageViewStore.snippetDestSize"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="snippetDisplaySize"
            :min="8"
            :max="320"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>
</template>

<style scoped lang="scss">
.min-width-130 {
    min-width: 130px;
}
.min-width-200 {
    min-width: 200px;
}
</style>
