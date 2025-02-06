import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { v4 as uuidv4 } from 'uuid';

export const useDataPointSelectionUntrracked = defineStore(
    'dataPointSelectionUntrracked',
    () => {
        const cellMetaData = useCellMetaData();
        const hoveredTime = ref<number | null>(null);
        const hoveredTrackId = ref<string | null>(null);
        // the hovered cell is assumed to be in the hovered track, so we just need
        // the index of the cell within that track
        const hoveredCellIndex = ref<number | null>(null);
        const triggerRecenter = ref<string>(uuidv4());
        function setTriggerRecenter() {
            triggerRecenter.value = uuidv4();
        }
        // slightly hacky way to retrigger an image recentering

        const hoveredFrameIndex = computed<number | null>(() => {
            if (hoveredTime.value === null) return null;
            const index = cellMetaData.timeList.findIndex(
                (t) => t === hoveredTime.value
            );
            if (index === -1) return null;
            return index;
        });

        function setHoveredCellIndex(time: number | null = null) {
            if (!cellMetaData.dataInitialized) return;
            const trackId = hoveredTrackId.value;
            if (!trackId) return;
            const track = cellMetaData.trackMap?.get(trackId);
            if (!track) return;
            if (time === null) time = hoveredTime.value;
            const cellIndex = track.cells.findIndex(
                (cell) => cellMetaData.getTime(cell) === time
            );
            if (cellIndex === -1) {
                hoveredCellIndex.value = null;
                return;
            }
            hoveredCellIndex.value = cellIndex;
        }
        return {
            hoveredTime,
            hoveredFrameIndex,
            hoveredTrackId,
            hoveredCellIndex,
            triggerRecenter,
            setHoveredCellIndex,
            setTriggerRecenter,
        };
    }
);
