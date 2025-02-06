<script setup lang="ts">
import { computed } from 'vue';

// Props
const props = defineProps({
    type: {
        type: String,
        default: 'confirm',
        validator: (value: string) =>
            [
                'confirm',
                'previous',
                'cancel',
                'basic',
                'action',
                'delete',
            ].includes(value),
    },
    label: {
        type: String,
        required: false,
    },
});

const isFlat = computed(
    () =>
        props.type === 'previous' ||
        props.type === 'basic' ||
        props.type === 'cancel'
);
const isUnelevated = computed(
    () => props.type === 'confirm' || props.type === 'delete'
);
const isOutline = computed(() => props.type === 'action');

const buttonColor = computed(() => {
    switch (props.type) {
        case 'confirm':
            return 'info';
        case 'cancel':
            return 'red';
        case 'delete':
            return 'red';
        case 'previous':
            return 'standard';
        case 'basic':
            return 'standard';
        default:
            return 'standard';
    }
});
</script>
<template>
    <q-btn
        v-bind="$attrs"
        :class="$attrs.class"
        :label="label"
        :color="buttonColor"
        :flat="isFlat"
        :outline="isOutline"
        :unelevated="isUnelevated"
        no-caps
    />
</template>
