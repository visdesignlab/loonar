<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useExemplarViewStore, horizonChartScheme } from '@/stores/componentStores/ExemplarViewStore';
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
    { label: 'Grey (Default)', value: horizonChartScheme },
    { label: 'Red', value: schemeReds[9] },
    { label: 'Blue', value: schemeBlues[9] }, // Use the 9-color version
    { label: 'Green', value: schemeGreens[9] }, // Use the 9-color version
    { label: 'Orange', value: schemeOranges[9] }, // Use the 9-color version
    { label: 'Purple', value: schemePurples[9] }, // Use the 9-color version
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
                    :dark="globalSettings.darkMode"
                    class="q-mr-sm min-width-130"
                />
                <q-select
                    label="Negative Colors"
                    v-model="horizonChartSettings.negativeColorScheme"
                    :options="colorSchemeOptions"
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
                >Horizon Chart Height:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.horizonChartHeight"
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
                >Histogram Width:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.histogramWidth"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.histogramWidth"
            :min="50"
            :max="800"
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
                v-model.number="snippetDisplaySize"
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

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Time Bar Height (Outer):</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.timeBarHeightOuter"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.timeBarHeightOuter"
            :min="2"
            :max="50"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Snippet-Horizon Gap:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.snippetHorizonChartGap"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.snippetHorizonChartGap"
            :min="0"
            :max="50"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Between Exemplar Gap:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.betweenExemplarGap"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.betweenExemplarGap"
            :min="0"
            :max="100"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Between Condition Gap:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.betweenConditionGap"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.betweenConditionGap"
            :min="0"
            :max="200"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Horizon-Histogram Gap:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.horizonHistogramGap"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.horizonHistogramGap"
            :min="0"
            :max="200"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Margin:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.margin"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.margin"
            :min="0"
            :max="500"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>
    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Margin:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.margin"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.margin"
            :min="0"
            :max="500"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Histogram Font Size:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.histogramFontSize"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.histogramFontSize"
            :min="8"
            :max="48"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Histogram Tooltip Font Size:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="exemplarViewStore.viewConfiguration.histogramTooltipFontSize"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="exemplarViewStore.viewConfiguration.histogramTooltipFontSize"
            :min="8"
            :max="36"
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
