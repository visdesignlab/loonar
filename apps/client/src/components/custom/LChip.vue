<script setup lang="ts">
// Props
defineProps({
    label: {
        type: String,
        required: true,
    },
});
</script>
<template>
    <q-chip color="primary" square dense outline :label="label" />
</template>
<style scoped lang="scss"></style>
