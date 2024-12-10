<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useExemplarViewStore } from '@/stores/componentStores/ExemplarViewStore';

const exemplarViewStore = useExemplarViewStore();

function testGenData() {
    exemplarViewStore.generateRandomTestData();
}
</script>

<template>
    <q-btn @click="testGenData">Test (generate new data)</q-btn>
</template>

<style scoped lang="scss"></style>
