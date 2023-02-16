import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useCellMetaData, type Cell } from '@/stores/cellMetaData';
import { min, max, mean } from 'd3-array';

export interface AggLineData extends Array<AggDataPoint> {}
export interface AggDataPoint {
    frame: number;
    value: number; // avg or total or median or ...
    count: number;
    // todo some measure of variance? std dev, extent etc.
}

function storeSetup() {
    // the only reason I've separated this function is to reduce indendation :shrug:
    const cellMetaData = useCellMetaData();

    const aggregatorKey = ref<string>('total');
    const aggregatorOptions = ['average', 'total', 'min', 'median', 'max'];

    const attributeKey = ref<string>(cellMetaData.headerKeys.mass);
    const targetKey = ref<string>('entire location');

    const targetOptions = [
        'cell tracks',
        'cell lineages',
        'entire location',
        'entire condition',
    ];

    const aggLineDataList = computed<AggLineData[]>(() => {
        const result: AggLineData[] = [];
        if (targetKey.value == 'entire location') {
            const singleLine: AggLineData = [];
            for (const frame of cellMetaData?.frameList ?? []) {
                const cellsAtFrame = cellMetaData.frameMap.get(frame);
                if (!cellsAtFrame) continue;
                const count = cellsAtFrame.length;
                let value: number = -1;
                if (aggregatorKey.value == 'average') {
                    value =
                        mean(
                            cellsAtFrame,
                            (cell: Cell) => cell.attrNum[attributeKey.value]
                        ) ?? 0;
                }
                singleLine.push({ frame, value, count });
            }
            result.push(singleLine);
        }
        return result;
    });

    const aggLineDataListExtent = computed(() => {
        const minVal = min(
            aggLineDataList.value,
            (aggLineData: AggLineData) => {
                return min(aggLineData, (point) => point.value);
            }
        );
        const maxVal = max(
            aggLineDataList.value,
            (aggLineData: AggLineData) => {
                return max(aggLineData, (point) => point.value);
            }
        );
        return [minVal, maxVal] as const;
    });

    return {
        aggregatorKey,
        aggregatorOptions,
        attributeKey,
        targetKey,
        targetOptions,
        aggLineDataList,
        aggLineDataListExtent,
    };
}

export const useAggregateLineChartStore = defineStore(
    'aggregateLineChartStore',
    storeSetup
);
