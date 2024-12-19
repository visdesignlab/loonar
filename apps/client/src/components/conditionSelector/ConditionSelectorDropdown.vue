<script setup lang="ts">
import {
    useConditionSelectorStore,
    type Axis,
} from '@/stores/componentStores/conditionSelectorStore';
import { storeToRefs } from 'pinia';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const globalSettings = useGlobalSettings();
const conditionSelectorStore = useConditionSelectorStore();
const { currentExperimentTags } = storeToRefs(conditionSelectorStore);
const props = defineProps({
    axis: {
        type: String,
        default: 'confirm',
        required: true,
        validator: (value: string) => ['x-axis', 'y-axis'].includes(value),
    },
});

const tagVar = props.axis === 'x-axis' ? 'selectedXTag' : 'selectedYTag';

function handleTagClick(item: string): void {
    const axis = props.axis as Axis;
    conditionSelectorStore.selectTag(item, axis);
}
</script>
<template>
    <q-btn-dropdown flat no-caps :label="conditionSelectorStore[tagVar]">
        <q-list :class="{ 'custom-dark': globalSettings.darkMode }">
            <template
                v-for="(item, index) in Object.keys(currentExperimentTags)"
                :key="index"
            >
                <q-item
                    clickable
                    v-close-popup
                    @click="() => handleTagClick(item)"
                >
                    <q-item-section>
                        <q-item-label>{{ item }}</q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-list>
    </q-btn-dropdown>
</template>

<style scoped>
.custom-dark {
    background-color: #1a1a1a; /* Example dark background */
    color: #ecf0f1; /* Example light text color */
}

.custom-dark .q-item {
    background-color: #1a1a1a; /* Darker shade for items */
}

.custom-dark .q-item-label {
    color: white; /* Light text for labels */
}
</style>
