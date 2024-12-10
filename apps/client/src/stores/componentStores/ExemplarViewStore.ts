import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export interface ExemplarTrack {
    trackId: string;
    locationId: string;
    minTime: number;
    maxTime: number;
    data: DataPoint[];
    tags: Record<string, string>;
    p: number; // the sample position, e.g. median has p=0.5
    pinned: boolean; // true if this is a user pinned exemplar
    starred: boolean; // true if this is a user starred exemplar
}

export interface DataPoint {
    time: number;
    frame: number;
    value: number;
}

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

    const exmplarTracks = ref<ExemplarTrack[]>([]);

    return { testData, generateRandomTestData, exmplarTracks };
});
