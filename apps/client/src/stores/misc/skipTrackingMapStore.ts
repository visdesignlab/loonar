import { defineStore } from 'pinia';

export const useSkipTrackingMap = defineStore('skipTrackingMap', () => {
    const map = new Map<string, boolean>();
    // not reactive, arguably does not need to be a pinia store
    // but nice for consistency and convenience accessing

    return {
        map,
    };
});
