import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
    useCellMetaData,
    type Cell,
    type Track,
} from '@/stores/dataStores/cellMetaDataStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import type { Feature, FeatureCollection } from 'geojson';
import { LRUCache } from 'lru-cache';
import { useConfigStore } from '../misc/configStore';

// interface LocationSegmentations {
//     location: string,
//     segmentations: Feature[];
// }
/**
 * Custom store for managing segmentations.
 * @returns An object containing functions to retrieve segmentations.
 */
export const useSegmentationStore = defineStore('segmentationStore', () => {
    const datasetSelectionStore = useDatasetSelectionStore();
    const cellMetaData = useCellMetaData();
    const configStore = useConfigStore();
    const filesGroupedByFrame = computed(() => datasetSelectionStore.segmentationGrouping === 'FrameFiles');

    const cache = ref(
        new LRUCache<string, Feature | FeatureCollection>({
            // TODO: this max for the cache is probably too large if we are saving frames.
            // could use diff max depending on if we are grabbing from frames vs. cells.
            max: filesGroupedByFrame.value ? 500 : 25_000,
            // each item is small (1-2 KB)
            fetchMethod: async (jsonUrl, staleValue, { signal }) => {
                return (await fetch(jsonUrl, { signal }).then((res) =>
                    res.json()
                )) as Feature | FeatureCollection;
            },
        })
    );
    /**
     * Get segmentations for a specific frame.
     * @param frame - The frame number, not the index, so the this is 1-based.
     * @returns An array of GeoJson features representing the segmentations.
     */
    async function getFrameSegmentations(frame: number): Promise<Feature[]> {
        if (filesGroupedByFrame.value) {
            const featureCollection = (await cache.value.fetch(
                `${segmentationFolderUrl.value}/${frame}.json`
            )) as FeatureCollection;
            return featureCollection.features;
        }
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
        const url = configStore.getFileUrl(
            datasetSelectionStore.currentLocationMetadata.segmentationsFolder
        );
        return url;
    });

    // Unused, delete
    // async function getCellLocationSegmentations(
    //     cells: Cell[]
    // ): Promise<Feature[] | undefined> {
    //     const promises = cells.map((cell) => getCellSegmentation(cell));
    //     return (await Promise.all(promises)).filter(
    //         (x) => x != null
    //     ) as Feature[];
    // }

    // Based on the frame, the id, and the location, return the feature (segmentation)
    async function getCellLocationSegmentation(frame: string, trackId: string, location: string): Promise<Feature | undefined> {
        const locationSegmentationUrl = configStore.getFileUrl(datasetSelectionStore.getLocationMetadata(location)?.segmentationsFolder || '');
        if (filesGroupedByFrame.value) {
            const featureCollection = (await cache.value.fetch(
                `${locationSegmentationUrl}/${frame}.json`
            )) as FeatureCollection;
            return featureCollection.features.find(
                (feature) => feature.properties?.id.toString() === trackId.toString()
            );
        }
        return (await cache.value.fetch(
            `${locationSegmentationUrl}/cells/${frame}-${trackId}.json`
        )) as Feature;
    }

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
        if (filesGroupedByFrame.value) {
            const featureCollection = (await cache.value.fetch(
                `${segmentationFolderUrl.value}/${frame}.json`
            )) as FeatureCollection;
            return featureCollection.features.find(
                (feature) => feature.properties?.id.toString() === id.toString()
            );
        }
        return (await cache.value.fetch(
            `${segmentationFolderUrl.value}/cells/${frame}-${id}.json`
        )) as Feature;
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
        getCellLocationSegmentation,
        // getCellLocationSegmentations,
        // getTrackSegmentations,
        getCellSegmentation,
        getCellSegmentations,
    };
});
