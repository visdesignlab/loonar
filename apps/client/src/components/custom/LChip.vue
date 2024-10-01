<script setup lang="ts">
import { computed } from 'vue';

// Props
const props = defineProps({
    label: {
        type: String,
        required: true,
    },
});
</script>
<template>
    <q-chip color="primary" class="l-chip" :label="label" />
</template>
<style scoped lang="scss">
.l-chip {
    border: 1px solid black;
    font-size: 0.6rem;
    border-radius: 6px;
}
</style>
