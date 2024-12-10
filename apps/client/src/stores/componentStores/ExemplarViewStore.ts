import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {
    const testOffset = 100;
    const testData = ref([
        [0, 0],
        [-testOffset, -testOffset],
        [testOffset, testOffset],
        [-testOffset, testOffset],
        [testOffset, -testOffset],
    ]);

    function generateRandomTestData(): void {
        testData.value = Array.from({ length: 5 }, () => [
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
        ]);
    }

    return { testData, generateRandomTestData };
});
