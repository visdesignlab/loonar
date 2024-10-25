<script setup lang="ts">
import {
    useConditionSelectorStore,
    type Axis,
} from '@/stores/componentStores/conditionSelectorStore';
import { storeToRefs } from 'pinia';
const conditionSelector = useConditionSelectorStore();
const {currentExperimentTags} = storeToRefs(conditionSelector);
const props = defineProps({
    axis: {
        type: String,
        default: 'confirm',
        required: true,
        validator: (value: string) => ['x-axis', 'y-axis'].includes(value),
    },
});

const tagVar = props.axis === 'x-axis' ? 'selectedXTag' : 'selectedYTag';

const handleTagClick = (item: string) => {
    const axis = props.axis as Axis;
    conditionSelector.selectTag(item, axis);
};
</script>
<template>
    <q-btn-dropdown flat no-caps :label="conditionSelector[tagVar]">
        <q-list>
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

<style></style>
