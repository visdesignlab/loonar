<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useExemplarViewStore, horizonChartScheme } from '@/stores/componentStores/ExemplarViewStore';
import {
    schemeReds,
    schemeBlues,
    schemeGreens,
    schemeOranges,
    schemePurples,
} from 'd3-scale-chromatic';

// Store imports
const globalSettings = useGlobalSettings();
const exemplarViewStore = useExemplarViewStore();
const { horizonChartSettings, histogramBinCount} = storeToRefs(exemplarViewStore);

// Accordion states
const imageSnippetsOpen = ref(false);
const histogramsOpen = ref(false);
const marginsOpen = ref(false);
const textOpen = ref(false);

// Horizon Chart ---------------
const horizonSettingsModal = ref(false);
const colorSchemeOptions = [
    { label: 'Grey (Default)', value: horizonChartScheme },
    { label: 'Red', value: schemeReds[9] },
    { label: 'Blue', value: schemeBlues[9] },
    { label: 'Green', value: schemeGreens[9] },
    { label: 'Orange', value: schemeOranges[9] },
    { label: 'Purple', value: schemePurples[9] },
];

// Histogram Chart ---------------
const histogramSettingsModal = ref(false);

// Snippet Display Size -------------------
const snippetDisplaySize = computed<number>({
  get: () => exemplarViewStore.viewConfiguration.snippetDisplayHeight,
  set: (val: number) => {
    exemplarViewStore.viewConfiguration.snippetDisplayHeight = val
    exemplarViewStore.viewConfiguration.snippetDisplayWidth  = val
  }
})

interface SliderMapping {
    key: string;
    min: number;
    max: number;
    step?: number;
    category: 'imageSnippets' | 'histograms' | 'margins' | 'text';
}

// View Configuration Sliders -------------------
const sliderMappings: Record<string, SliderMapping> = {
    'Horizon Chart Height': { key: 'horizonChartHeight', min: 4, max: 240, category: 'imageSnippets' },
    'Time Bar Height (Outer)': { key: 'timeBarHeightOuter', min: 2, max: 50, category: 'imageSnippets' },
    'Snippet Source Size': { key: 'snippetSourceSize', min: 8, max: 320, step: 2, category: 'imageSnippets' },
    'Snippet-Horizon Gap': { key: 'snippetHorizonChartGap', min: 0, max: 50, category: 'margins' },
    'Between Exemplar Gap': { key: 'betweenExemplarGap', min: 0, max: 100, category: 'margins' },
    'Between Condition Gap': { key: 'betweenConditionGap', min: 0, max: 200, category: 'margins' },
    'Margin': { key: 'margin', min: 0, max: 500, category: 'margins' },
    'Horizon-Histogram Gap': { key: 'horizonHistogramGap', min: exemplarViewStore.viewConfiguration.histogramFontSize * 2, max: 200, category: 'margins' },
    'Histogram Width': { key: 'histogramWidth', min: 50, max: 800, category: 'histograms' },
    'Histogram Font Size': { key: 'histogramFontSize', min: 8, max: 48, category: 'text' },
    'Histogram Tooltip Font Size': { key: 'histogramTooltipFontSize', min: 8, max: 36, category: 'text' }
};

// Generate slider configs dynamically
const sliderConfigs = computed((): {
  label: string;
  model: any;
  min: number;
  max: number;
  step: number;
  category: string;
}[] => [
     // Special case for snippet display size (controls both height and width)
     {
         label: 'Snippet Display Size',
         model: snippetDisplaySize,
         min: 8,
         max: 320,
         step: 1,
         category: 'imageSnippets'
     },
     // Generate all other view configuration sliders
     ...Object.entries(sliderMappings).map(([label, config]) => ({
         label,
         model: computed({
             get: () => (exemplarViewStore.viewConfiguration as any)[config.key],
             set: (val) => { (exemplarViewStore.viewConfiguration as any)[config.key] = val; }
         }),
         min: config.min,
         max: config.max,
         step: config.step ?? 1,
         category: config.category
     }))
]);

// Categorized sliders
const imageSnippetSliders = computed(() => sliderConfigs.value.filter(config => config.category === 'imageSnippets'));
const histogramSliders = computed(() => sliderConfigs.value.filter(config => config.category === 'histograms'));
const marginSliders = computed(() => sliderConfigs.value.filter(config => config.category === 'margins'));
const textSliders = computed(() => sliderConfigs.value.filter(config => config.category === 'text'));
</script>

<template>
    <q-btn class="q-mb-sm" @click="horizonSettingsModal = true" outline
        >Configure Horizon Charts</q-btn
    >
    <div class="row justify-center q-mb-sm">
        <q-btn @click="histogramSettingsModal = true" outline>
            Configure Histograms
        </q-btn>
    </div>
    <!-- Horizon Chart Settings Modal -->
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

    <!-- Histogram Settings Modal -->
    <q-dialog v-model="histogramSettingsModal">
        <q-card style="min-width: 400px" :dark="globalSettings.darkMode">
            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6">Configure Histograms</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section>
                <q-input
                    label="Bin Count"
                    v-model.number="histogramBinCount"
                    type="number"
                    :dark="globalSettings.darkMode"
                    debounce="400"
                    min="1"
                    max="200"
                    hint="Number of bins for histogram display"
                />
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

    <!-- Image Snippets Accordion -->
    <q-expansion-item
        v-model="imageSnippetsOpen"
        icon="image"
        label="Image Snippets"
        :dark="globalSettings.darkMode"
        class="q-mt-md"
    >
        <q-card-section 
            v-for="config in imageSnippetSliders" 
            :key="config.label"
            class="q-pl-none q-pr-none"
        >
            <div class="flex row no-wrap">
                <q-badge outline :color="globalSettings.normalizedBlack">
                    {{ config.label }}:
                </q-badge>
                <q-input
                    class="q-pl-md"
                    dense
                    v-model.number="config.model.value"
                    type="number"
                    :step="config.step"
                    :dark="globalSettings.darkMode"
                />
            </div>
            <q-slider
                v-model="config.model.value"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
    </q-expansion-item>

    <!-- Histograms Accordion -->
    <q-expansion-item
        v-model="histogramsOpen"
        icon="bar_chart"
        label="Histograms"
        :dark="globalSettings.darkMode"
        class="q-mt-sm"
    >
        <q-card-section 
            v-for="config in histogramSliders" 
            :key="config.label"
            class="q-pl-none q-pr-none"
        >
            <div class="flex row no-wrap">
                <q-badge outline :color="globalSettings.normalizedBlack">
                    {{ config.label }}:
                </q-badge>
                <q-input
                    class="q-pl-md"
                    dense
                    v-model.number="config.model.value"
                    type="number"
                    :step="config.step"
                    :dark="globalSettings.darkMode"
                />
            </div>
            <q-slider
                v-model="config.model.value"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
    </q-expansion-item>

    <!-- Margins Accordion -->
    <q-expansion-item
        v-model="marginsOpen"
        icon="margin"
        label="Margins"
        :dark="globalSettings.darkMode"
        class="q-mt-sm"
    >
        <q-card-section 
            v-for="config in marginSliders" 
            :key="config.label"
            class="q-pl-none q-pr-none"
        >
            <div class="flex row no-wrap">
                <q-badge outline :color="globalSettings.normalizedBlack">
                    {{ config.label }}:
                </q-badge>
                <q-input
                    class="q-pl-md"
                    dense
                    v-model.number="config.model.value"
                    type="number"
                    :step="config.step"
                    :dark="globalSettings.darkMode"
                />
            </div>
            <q-slider
                v-model="config.model.value"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
    </q-expansion-item>

    <!-- Text Accordion -->
    <q-expansion-item
        v-model="textOpen"
        icon="text_fields"
        label="Text"
        :dark="globalSettings.darkMode"
        class="q-mt-sm"
    >
        <q-card-section 
            v-for="config in textSliders" 
            :key="config.label"
            class="q-pl-none q-pr-none"
        >
            <div class="flex row no-wrap">
                <q-badge outline :color="globalSettings.normalizedBlack">
                    {{ config.label }}:
                </q-badge>
                <q-input
                    class="q-pl-md"
                    dense
                    v-model.number="config.model.value"
                    type="number"
                    :step="config.step"
                    :dark="globalSettings.darkMode"
                />
            </div>
            <q-slider
                v-model="config.model.value"
                :min="config.min"
                :max="config.max"
                :step="config.step"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
    </q-expansion-item>
</template>

<style scoped lang="scss">
.min-width-130 {
    min-width: 130px;
}
.min-width-200 {
    min-width: 200px;
}
</style>
