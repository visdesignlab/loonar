<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useLooneageViewStore } from '@/stores/componentStores/looneageViewStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';
import { clamp } from 'lodash-es';

import {
    schemeReds,
    schemeBlues,
    schemeGreens,
    schemeGreys,
    schemeOranges,
    schemePurples,
} from 'd3-scale-chromatic';

const cellMetaData = useCellMetaData();
const globalSettings = useGlobalSettings();
const looneageViewStore = useLooneageViewStore();
const eventBusStore = useEventBusStore();

const colorSchemeOptions = [
    { label: 'Red', value: schemeReds },
    { label: 'Blue', value: schemeBlues },
    { label: 'Green', value: schemeGreens },
    { label: 'Orange', value: schemeOranges },
    { label: 'Purple', value: schemePurples },
];

const horizonSettingsModal = ref(false);
</script>

<template>
    <q-btn
        class="q-mb-sm"
        @click="eventBusStore.emitter.emit('resetLooneageView')"
        icon="center_focus_strong"
        outline
        >Reset View</q-btn
    >
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
                    v-for="(
                        setting, index
                    ) in looneageViewStore.horizonChartSettingList"
                    :key="index"
                    class="row no-wrap justify-center q-mb-lg"
                >
                    <q-select
                        label="Attribute"
                        v-model="setting.attrKey"
                        :options="cellMetaData.cellNumAttributeHeaderNames"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm min-width-200"
                    />
                    <q-select
                        label="Positive Colors"
                        v-model="setting.positiveColorScheme"
                        :options="colorSchemeOptions"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm min-width-130"
                    />
                    <q-select
                        label="Negative Colors"
                        v-model="setting.negativeColorScheme"
                        :options="colorSchemeOptions"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm min-width-130"
                    />
                    <q-input
                        label="Bin Size"
                        v-model.number="setting.modHeight"
                        type="number"
                        :dark="globalSettings.darkMode"
                        debounce="400"
                        class="q-mr-sm"
                    />
                    <q-input
                        label="Baseline"
                        v-model.number="setting.baseline"
                        type="number"
                        :dark="globalSettings.darkMode"
                        class="q-mr-sm"
                    />
                    <q-icon
                        v-if="
                            looneageViewStore.horizonChartSettingList.length ===
                            1
                        "
                        name="lock"
                        size="sm"
                        class="q-mt-md q-mb-md"
                    />
                    <q-btn
                        v-else
                        icon="delete"
                        outline
                        dense
                        class="q-mt-md q-mb-md"
                        @click="looneageViewStore.removeHorizonChart(index)"
                    />
                </div>
                <div class="row no-wrap justify-center q-ml-xl q-mr-xl q-mt-md">
                    <q-btn
                        outline
                        icon="add_box"
                        class="full-width"
                        @click="
                            looneageViewStore.addHorizonChart(
                                colorSchemeOptions
                            )
                        "
                        >Add Attribute</q-btn
                    >
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Done" v-close-popup />
            </q-card-actions>
        </q-card>
    </q-dialog>

    <q-toggle
        label="Show Snippet Image"
        v-model="looneageViewStore.showSnippetImage"
        :dark="globalSettings.darkMode"
    />
    <q-toggle
        label="Show Snippet Outline"
        v-model="looneageViewStore.showSnippetOutline"
        :dark="globalSettings.darkMode"
    />
    <q-toggle
        label="Space Snippets Evenly"
        v-model="looneageViewStore.spaceKeyframesEvenly"
        :dark="globalSettings.darkMode"
    />
    <q-toggle
        label="Include sibling buffers"
        v-model="looneageViewStore.includeSiblingBuffer"
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
            v-model="looneageViewStore.rowHeight"
            :min="4"
            :max="240"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>
    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Spacing:</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="looneageViewStore.spacing"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="looneageViewStore.spacing"
            :min="0"
            :max="300"
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
                v-model.number="looneageViewStore.snippetSourceSize"
                type="number"
                :step="2"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="looneageViewStore.snippetSourceSize"
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
            v-model="looneageViewStore.snippetDestSize"
            :min="8"
            :max="320"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>

    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Max Depth</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="looneageViewStore.maxDepth"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="looneageViewStore.maxDepth"
            :min="0"
            :max="20"
            label
            :dark="globalSettings.darkMode"
        />
    </q-card-section>
    <q-card-section class="q-pl-none q-pr-none">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Connecting Line Width</q-badge
            >
            <q-input
                class="q-pl-md"
                dense
                v-model.number="looneageViewStore.connectingLineWidth"
                type="number"
                :dark="globalSettings.darkMode"
            />
        </div>
        <q-slider
            v-model="looneageViewStore.connectingLineWidth"
            :min="0.1"
            :max="100"
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
