

<script setup lang="ts">
import { useConditionSelector, type Axis } from '@/stores/componentStores/conditionSelectorStore';
const conditionSelector = useConditionSelector();

const props = defineProps({
    axis: {
        type: String,
        default: 'confirm',
        required:true,
        validator: (value: string) =>
            [
                'x-axis',
                'y-axis'
            ].includes(value),
    },
});

const tagVar = props.axis === 'x-axis' ? 'selectedXTag' : 'selectedYTag';

const handleTagClick = (item:string) => {
    conditionSelector.selectTag(item, props.axis);
}

</script>
<template>
    <q-btn-dropdown flat no-caps :label="conditionSelector[tagVar]">
        <q-list>
            <template v-for="item in conditionSelector.tags">
                <q-item clickable v-close-popup @click="() => handleTagClick(item)">
                    <q-item-section>
                    <q-item-label>{{item}}</q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-list>
    </q-btn-dropdown>
</template>

<style></style>


