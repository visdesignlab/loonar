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
const bannerClasses = computed(() => {
    return {
        'banner banner-success q-pa-md': props.type === 'success',
        'banner banner-error q-pa-md': props.type === 'error',
        'banner banner-warning q-pa-md': props.type === 'warning',
        'banner banner-info q-pa-md ': props.type === 'info',
    };
});
</script>

<template>
    <q-banner :class="[bannerClasses, $attrs.class]" :icon="bannerIcon" dense>
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
.q-banner.banner {
    border-radius: 4px;
    color: white;

    &.banner-success {
        background-color: $green-7;
        border: 2px solid $green-8;
    }

    &.banner-warning {
        background-color: $yellow-9;
        border: 2px solid $yellow-9;
    }

    &.banner-info {
        background-color: $blue-7;
        border: 2px solid $blue-9;
    }

    &.banner-error {
        background-color: $red-7;
        border: 2px solid $red-10;
    }
    .banner-icon {
        font-size: 30px !important;
    }
    .q-banner__content > div {
        font-size: 12pt;
    }
}
</style>
