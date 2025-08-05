import { useDatasetSelectionTrrackedStore } from '../dataStores/datasetSelectionTrrackedStore';
import { useGridstackLayoutStore } from '../interactionStores/gridstackLayoutStore';
import { useGlobalSettings } from '../componentStores/globalSettingsStore';
import { useAggregateLineChartStore } from '../componentStores/aggregateLineChartStore';
import { useDatasetSelectionStore } from '../dataStores/datasetSelectionUntrrackedStore';
import { useImageViewerStore } from '../componentStores/imageViewerTrrackedStore';
import { useLooneageViewStore } from '../componentStores/looneageViewStore';
import { useDataPointSelection } from '../interactionStores/dataPointSelectionTrrackedStore';
import { useSelectionStore } from '../interactionStores/selectionStore';
import { useConditionSelectorStore } from '../componentStores/conditionSelectorStore';
import { useSkipTrackingMap } from '@/stores/misc/skipTrackingMapStore';
import { defineStore } from 'pinia';
import { initializeTrrack, Registry, type Trigger } from '@trrack/core';
import { cloneDeep, isEqual, debounce } from 'lodash-es';
import {
    compressToEncodedURIComponent,
    decompressFromEncodedURIComponent,
} from 'lz-string';

export interface SubStores {
    [storeId: string]: Object;
}

export interface RegisterActions {
    [storeId: string]: any;
    // [storeId: string]: ActionCreatorWithPayload<any, string>;
}

export const useProvenanceStore = defineStore('provenanceStore', () => {
    const skipTrackingMap = useSkipTrackingMap();
    // not tracked. Used to skip tracking programatic changes to stores

    const storesToTrrack = [
        useGlobalSettings(),
        useGridstackLayoutStore(),
        useAggregateLineChartStore(),
        useImageViewerStore(),
        useDatasetSelectionTrrackedStore(),
        useLooneageViewStore(),
        useDataPointSelection(),
        useSelectionStore(),
        useConditionSelectorStore(),
    ];

    const initialState: SubStores = {};
    const registerActions: RegisterActions = {};
    const registry = Registry.create();
    for (const store of storesToTrrack) {
        const storeId = store.$id;
        initialState[storeId] = cloneDeep(store.$state);
        registerActions[storeId] = registry.register(
            storeId,
            (trrackState, newPiniaState) => {
                trrackState[storeId] = cloneDeep(newPiniaState);
            }
        );
    }

    let trrackPrevious;
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    const urlParamTrrack = searchParams.get('state');
    if (urlParamTrrack) {
        trrackPrevious = JSON.parse(
            decompressFromEncodedURIComponent(urlParamTrrack) ?? ''
        );
    } else {
        trrackPrevious = initialState;
    }

    const provenance = initializeTrrack({
        initialState: trrackPrevious,
        registry,
    });
    if (urlParamTrrack) {
        useDatasetSelectionStore();
        // not tracked, but needs to be initialized for the case
        // where you open url and data is loaded but DatasetSelector.vue
        // is not initialized since it is hidden.
        updateVueState();
    }

    for (const store of storesToTrrack) {
        store.$subscribe(
            debounce((mutation, state) => {
                const storeId = mutation.storeId;

                if (skipTrackingMap.map.get(storeId)) {
                    skipTrackingMap.map.set(storeId, false);
                    // console.count('SKIPPED');
                    return;
                }

                if (isEqual(state, provenance.getState()[storeId])) {
                    return;
                }
                provenance.apply(storeId, registerActions[storeId](state));
            }, 500)
        );
    }

    provenance.currentChange(() => {
        const url = new URL(window.location.href);
        const searchParams = new URLSearchParams(url.search);
        searchParams.set(
            'state',
            compressToEncodedURIComponent(JSON.stringify(provenance.getState()))
        );
        url.search = searchParams.toString();
        window.history.replaceState(null, '', url);
    });

    provenance.currentChange(() => {
        updateVueState();
    }, true);

    function updateVueState(): void {
        for (const store of storesToTrrack) {
            store.$state = cloneDeep(provenance.getState()[store.$id]) as any;
        }
    }

    return {
        provenance,
    };
});
