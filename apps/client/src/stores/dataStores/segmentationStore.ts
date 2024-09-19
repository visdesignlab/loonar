import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
    useCellMetaData,
    type Cell,
    type Track,
} from '@/stores/dataStores/cellMetaDataStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import type { Feature } from 'geojson';
import { LRUCache } from 'lru-cache';
import { useConfigStore } from '../misc/configStore';

/**
 * Custom store for managing segmentations.
 * @returns An object containing functions to retrieve segmentations.
 */
export const useSegmentationStore = defineStore('segmentationStore', () => {
    const datasetSelectionStore = useDatasetSelectionStore();
    const cellMetaData = useCellMetaData();
    const configStore = useConfigStore();
    const cache = ref(
        new LRUCache<string, Feature>({
            max: 25_000,
            // each item is small (1-2 KB)
            fetchMethod: async (jsonUrl, staleValue, { signal }) => {
                return (await fetch(jsonUrl, { signal }).then((res) =>
                    res.json()
                )) as Feature;
            },
        })
    );
    /**
     * Get segmentations for a specific frame.
     * @param frame - The frame number, not the index, so the this is 1-based.
     * @returns An array of GeoJson features representing the segmentations.
     */
    async function getFrameSegmentations(frame: number): Promise<Feature[]> {
        // Implementation goes here
        const cells = cellMetaData.frameMap.get(frame);
        if (!cells) return [];
        const promises = cells.map((cell) => getCellSegmentation(cell));
        return (await Promise.all(promises)).filter(
            (x) => x != null
        ) as Feature[];
    }

    // /**
    //  * Get segmentations for a specific track.
    //  * @param track - The track object.
    //  * @returns An array of GeoJson features representing the segmentations.
    //  */
    // async function getTrackSegmentations(track: Track): Promise<Feature[]> {
    //     // Implementation goes here
    // }

    const segmentationFolderUrl = computed<string>(() => {
        if (
            datasetSelectionStore.currentLocationMetadata
                ?.segmentationsFolder == null
        ) {
            return '';
        }
        return configStore.getFileUrl(
            datasetSelectionStore.currentLocationMetadata.segmentationsFolder
        );
    });

    /**
     * Get segmentations for a specific cell.
     * @param cell - The cell object.
     * @returns A GeoJson feature representing the segmentation.
     */
    async function getCellSegmentation(
        cell: Cell
    ): Promise<Feature | undefined> {
        const frame = cellMetaData.getFrame(cell);
        const id = cell.trackId;
        return await cache.value.fetch(
            `${segmentationFolderUrl}/cells/${frame}-${id}.json`
        );
    }

    async function getCellSegmentations(
        cells: Cell[]
    ): Promise<Feature[] | undefined> {
        const promises = cells.map((cell) => getCellSegmentation(cell));
        return (await Promise.all(promises)).filter(
            (x) => x != null
        ) as Feature[];
    }

    return {
        getFrameSegmentations,
        // getTrackSegmentations,
        getCellSegmentation,
        getCellSegmentations,
    };
});
