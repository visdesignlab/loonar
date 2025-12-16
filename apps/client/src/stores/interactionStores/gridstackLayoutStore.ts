import { useStorage } from '@vueuse/core';
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash-es';
import { useDatasetSelectionStore } from '../dataStores/datasetSelectionUntrrackedStore';
export interface LayoutItem {
    // gridstack properties plus my own
    component: string;
    displayName: string;
    x: number;
    y: number;
    w: number;
    h: number;
    id: string;
    noPadding?: boolean;
    hideOverflow?: boolean;
    icon?: string;
    sidebar?: string;
    toolbar?: string;
    props?: any;
}

export interface Item {
    // propoerties other than the layout ones
    component: string;
    displayName: string;
    id: string;
    noPadding?: boolean;
    hideOverflow?: boolean;
    icon?: string;
    sidebar?: string;
    toolbar?: string;
    props?: any;
}

export interface GridstackItem {
    // properties expected by a gridstack item
    x: number;
    y: number;
    w: number;
    h: number;
    id: string;
}

export interface Layout {
    name: string;
    editable: boolean;
    editing: boolean;
    id: string;
    initialItems: LayoutItem[];
    currentItems: LayoutItem[];
}

export const useGridstackLayoutStore = defineStore(
    'gridstackLayoutStore',
    () => {
        // const smallImageItems: LayoutItem[] = [
        //     {
        //         component: 'LooneageView',
        //         displayName: 'Looneage',
        //         x: 4,
        //         y: 0,
        //         w: 4,
        //         h: 21,
        //         id: 'LooneageView',
        //         icon: 'account_tree',
        //         sidebar: 'LooneageViewSettingsSidebar',
        //         toolbar: 'LooneageViewSettingsToolbar',
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Lineages',
        //         x: 8,
        //         y: 0,
        //         w: 2,
        //         h: 7,
        //         id: 'SimpleTable-lineage',
        //         props: {
        //             attributeLevel: 'lineage',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Tracks',
        //         x: 8,
        //         y: 7,
        //         w: 2,
        //         h: 7,
        //         id: 'SimpleTable-track',
        //         props: {
        //             attributeLevel: 'track',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Cells',
        //         x: 8,
        //         y: 14,
        //         w: 2,
        //         h: 7,
        //         id: 'SimpleTable-cell',
        //         props: {
        //             attributeLevel: 'cell',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'AggregateLineChart',
        //         displayName: 'Line Chart',
        //         x: 0,
        //         y: 5,
        //         w: 4,
        //         h: 7,
        //         id: 'AggregateLineChart',
        //         icon: 'timeline',
        //         sidebar: 'AggregateLineChartSettingsSidebar',
        //         toolbar: 'AggregateLineChartSettingsToolbar',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'ImageViewer',
        //         displayName: 'Images',
        //         x: 0,
        //         y: 12,
        //         w: 4,
        //         h: 9,
        //         id: 'ImageViewer',
        //         noPadding: true,
        //         icon: 'image',
        //         sidebar: 'ImageViewerSettingsSidebar',
        //         toolbar: 'ImageViewerSettingsToolbar',
        //     },
        //     {
        //         component: 'BasicInfo',
        //         displayName: 'Overview',
        //         x: 0,
        //         y: 0,
        //         w: 4,
        //         h: 5,
        //         id: 'BasicInfo',
        //         icon: 'info',
        //     },
        //     {
        //         component: 'TrrackVisWrapper',
        //         displayName: 'History',
        //         x: 10,
        //         y: 0,
        //         w: 2,
        //         h: 21,
        //         id: 'TrrackVisWrapper',
        //         icon: 'history',
        //         noPadding: true,
        //     },
        // ];

        // const largeImageItems: LayoutItem[] = [
        //     {
        //         component: 'LooneageView',
        //         displayName: 'Looneage',
        //         x: 4,
        //         y: 5,
        //         w: 6,
        //         h: 5,
        //         id: 'LooneageView',
        //         icon: 'account_tree',
        //         sidebar: 'LooneageViewSettingsSidebar',
        //         toolbar: 'LooneageViewSettingsToolbar',
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Lineages',
        //         x: 4,
        //         y: 10,
        //         w: 2,
        //         h: 11,
        //         id: 'SimpleTable-lineage',
        //         props: {
        //             attributeLevel: 'lineage',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Tracks',
        //         x: 6,
        //         y: 10,
        //         w: 2,
        //         h: 11,
        //         id: 'SimpleTable-track',
        //         props: {
        //             attributeLevel: 'track',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'SimpleTable',
        //         displayName: 'Cells',
        //         x: 8,
        //         y: 10,
        //         w: 2,
        //         h: 11,
        //         id: 'SimpleTable-cell',
        //         props: {
        //             attributeLevel: 'cell',
        //         },
        //         icon: 'table_chart',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'AggregateLineChart',
        //         displayName: 'Line Chart',
        //         x: 4,
        //         y: 0,
        //         w: 6,
        //         h: 5,
        //         id: 'AggregateLineChart',
        //         icon: 'timeline',
        //         sidebar: 'AggregateLineChartSettingsSidebar',
        //         toolbar: 'AggregateLineChartSettingsToolbar',
        //         noPadding: true,
        //     },
        //     {
        //         component: 'ImageViewer',
        //         displayName: 'Images',
        //         x: 0,
        //         y: 5,
        //         w: 4,
        //         h: 16,
        //         id: 'ImageViewer',
        //         noPadding: true,
        //         icon: 'image',
        //         sidebar: 'ImageViewerSettingsSidebar',
        //         toolbar: 'ImageViewerSettingsToolbar',
        //     },
        //     {
        //         component: 'BasicInfo',
        //         displayName: 'Overview',
        //         x: 0,
        //         y: 0,
        //         w: 4,
        //         h: 5,
        //         id: 'BasicInfo',
        //         icon: 'info',
        //     },
        //     {
        //         component: 'TrrackVisWrapper',
        //         displayName: 'History',
        //         x: 10,
        //         y: 0,
        //         w: 2,
        //         h: 21,
        //         id: 'TrrackVisWrapper',
        //         icon: 'history',
        //         noPadding: true,
        //     },
        // ];

        const datasetSelectionStore = useDatasetSelectionStore();

        const allEqualItems = computed<LayoutItem[]>(() => {
            const items: LayoutItem[] = [
                {
                    component: 'ConditionSelector',
                    displayName: 'Condition Selector',
                    h: 20,
                    icon: 'apps',
                    id: 'ConditionSelector',
                    noPadding: true,
                    w: 6,
                    x: 0,
                    y: 10,
                },
                {
                    component: 'ExemplarView',
                    displayName: 'Exemplar View',
                    h: 10,
                    hideOverflow: true,
                    icon: 'location_on',
                    id: 'ExemplarView',
                    noPadding: true,
                    sidebar: 'ExemplarViewSettingsSidebar',
                    toolbar: 'ExemplarViewSettingsToolbar',
                    w: 6,
                    x: 6,
                    y: 0,
                },
                {
                    component: 'LooneageViewGL',
                    displayName: 'Looneage',
                    h: 10,
                    hideOverflow: true,
                    icon: 'account_tree',
                    id: 'LooneageViewGL',
                    noPadding: true,
                    sidebar: 'LooneageViewSettingsSidebar',
                    toolbar: 'LooneageViewSettingsToolbar',
                    w: 6,
                    x: 0,
                    y: 0,
                },
                {
                    component: 'AggregateLineChart',
                    displayName: 'Line Chart',
                    h: 10,
                    icon: 'timeline',
                    id: 'AggregateLineChart',
                    noPadding: true,
                    sidebar: 'AggregateLineChartSettingsSidebar',
                    toolbar: 'AggregateLineChartSettingsToolbar',
                    w: 6,
                    x: 6,
                    y: 10,
                },
                {
                    component: 'SimpleTable',
                    displayName: 'Lineages',
                    h: 10,
                    icon: 'table_chart',
                    id: 'SimpleTable-lineage',
                    noPadding: true,
                    props: {
                        attributeLevel: 'lineage',
                    },
                    w: 6,
                    x: 0,
                    y: 30,
                },
                {
                    component: 'ImageViewer',
                    displayName: 'Images',
                    h: 10,
                    hideOverflow: true,
                    icon: 'image',
                    id: 'ImageViewer',
                    noPadding: true,
                    sidebar: 'ImageViewerSettingsSidebar',
                    toolbar: 'ImageViewerSettingsToolbar',
                    w: 6,
                    x: 6,
                    y: 20,
                },
                {
                    component: 'SimpleTable',
                    displayName: 'Tracks',
                    h: 10,
                    icon: 'table_chart',
                    id: 'SimpleTable-track',
                    noPadding: true,
                    props: {
                        attributeLevel: 'track',
                    },
                    w: 6,
                    x: 0,
                    y: 40,
                },
                {
                    component: 'SimpleTable',
                    displayName: 'Cells',
                    h: 10,
                    icon: 'table_chart',
                    id: 'SimpleTable-cell',
                    noPadding: true,
                    props: {
                        attributeLevel: 'cell',
                    },
                    w: 6,
                    x: 6,
                    y: 30,
                },
                {
                    component: 'TrrackVisWrapper',
                    displayName: 'History',
                    h: 10,
                    icon: 'history',
                    id: 'TrrackVisWrapper',
                    noPadding: true,
                    w: 6,
                    x: 0,
                    y: 50,
                },
            ];

            const locationCount =
                datasetSelectionStore.currentExperimentMetadata
                    ?.locationMetadataList.length ?? 0;

            if (locationCount > 20) {
                const conditionSelector = items.find(
                    (item) => item.id === 'ConditionSelector'
                );
                const looneageView = items.find(
                    (item) => item.id === 'LooneageViewGL'
                );

                if (conditionSelector && looneageView) {
                    conditionSelector.y = 0;
                    looneageView.y = 20;
                }
            }

            return items;
        });

        const defaultId = 'system_layout_0';

        const allEqualLayout = computed<Layout>(() => ({
            name: 'Default',
            editable: false,
            editing: false,
            id: defaultId,
            initialItems: cloneDeep(allEqualItems.value),
            currentItems: cloneDeep(allEqualItems.value),
        }));

        // console.log('Default layout object:', allEqualLayout.value);

        const currentLayoutId = useStorage<string>(
            'currentLayoutId',
            defaultId
        );

        const systemLayoutOptions = computed<Layout[]>(() => [
            allEqualLayout.value,
        ]);
        const userLayoutOptions = useStorage<Layout[]>('userLayoutOptions', []);
        const allLayouts = computed<Map<string, Layout>>(() => {
            const layouts = new Map();
            for (const layout of systemLayoutOptions.value) {
                layouts.set(layout.id, layout);
            }
            for (const layout of userLayoutOptions.value) {
                layouts.set(layout.id, layout);
            }
            return layouts;
        });
        const currentLayout = computed<Layout | null>(() => {
            const layout = allLayouts.value.get(currentLayoutId.value);
            return layout ?? null;
        });
        const currentLayoutLookup = computed<Map<string, LayoutItem>>(() => {
            const lookup = new Map();
            if (currentLayout.value == null) return lookup;
            for (const item of currentLayout.value.currentItems) {
                lookup.set(item.id, item);
            }
            return lookup;
        });
        function updateItem(newItem: GridstackItem): void {
            const oldItem = currentLayoutLookup.value.get(newItem.id);
            if (oldItem == null) return;
            oldItem.x = newItem.x;
            oldItem.y = newItem.y;
            oldItem.w = newItem.w;
            oldItem.h = newItem.h;
        }

        function createNew(): void {
            const newLayout = ref<Layout>({
                name: 'My Custom Layout',
                editable: true,
                editing: false,
                id: uuidv4(),
                initialItems:
                    cloneDeep(currentLayout?.value?.currentItems) ?? [],
                currentItems:
                    cloneDeep(currentLayout?.value?.currentItems) ?? [],
            });
            newLayout.value.name = 'My Custom Layout';
            userLayoutOptions.value.push(newLayout.value);
            currentLayoutId.value = newLayout.value.id;
        }
        function updateCurrent(): void {
            if (currentLayout.value == null) return;
            currentLayout.value.initialItems = cloneDeep(
                currentLayout.value.currentItems
            );
        }
        function deleteLayout(index: number): void {

            const removed = userLayoutOptions.value.splice(index, 1)[0];

            if (removed.id == currentLayoutId.value) {
                currentLayoutId.value = defaultId;
            }
        }
        function resetLayout(layout: Layout): void {
            layout.currentItems = cloneDeep(layout.initialItems);
            currentLayoutId.value = layout.id;
        }
        return {
            currentLayout,
            currentLayoutId,
            systemLayoutOptions,
            userLayoutOptions,
            updateItem,
            createNew,
            updateCurrent,
            deleteLayout,
            resetLayout,
        };
    }
);
