<script setup lang="ts">
import { computed } from 'vue';
import { QBanner, QIcon } from 'quasar';

// Props
const props = defineProps({
    type: {
        type: String,
        default: 'info',
        validator: (value: string) =>
            ['success', 'error', 'warning', 'info'].includes(value),
    },
    message: {
        type: String,
        required: true,
    },
});

const bannerIcon = computed(() => {
    switch (props.type) {
        case 'success':
            return 'check_circle';
        case 'error':
            return 'error';
        case 'warning':
            return 'warning';
        case 'info':
        default:
            return 'info';
    }
});

// Define dynamic classes based on `type`
const bannerTypeClass = computed(() => {
    return {
        'banner-success': props.type === 'success',
        'banner-error': props.type === 'error',
        'banner-warning': props.type === 'warning',
        'banner-info ': props.type === 'info',
    };
});
</script>

<template>
    <q-banner
        :class="[
            'banner',
            'q-pa-md',
            'rounded-borders',
            bannerTypeClass,
            $attrs.class,
        ]"
        :icon="bannerIcon"
        dense
    >
        <template v-slot:avatar>
            <q-icon :name="bannerIcon" class="banner-icon" />
        </template>

        <div>{{ message }}</div>
        <template v-slot:action>
            <slot name="action"></slot>
        </template>
    </q-banner>
</template>

<style lang="scss" scoped>
.banner {
    border-style: solid;
    border-width: 2px;

    &.banner-success {
        background-color: $green-1;
        border-color: $green-8;
        color: $green-10;
    }

    &.banner-warning {
        background-color: $yellow-1;
        border-color: $orange-7;
        color: $deep-orange-10;
    }

    &.banner-info {
        background-color: $blue-1;
        border-color: $blue-9;
        color: $blue-10;
    }

    &.banner-error {
        background-color: $red-1;
        border-color: $red-10;
        color: $red-10;
    }
}
</style>
