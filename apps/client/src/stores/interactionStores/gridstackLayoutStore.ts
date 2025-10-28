import { useStorage } from '@vueuse/core';
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep } from 'lodash-es';
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

        function setEqualItems(items: Item[]): LayoutItem[] {
            const layoutItems: LayoutItem[] = [];
            const height = 10;
            const w = 6;
            let x = 0;
            let y = 0;
            let first = true; // the first item should be double height.
            let i = 0;
            for (const item of items) {
                const h = first ? 2 * height : height;
                const thisY = i % 2 === 1 || first ? y : y + 10;
                const layoutItem: LayoutItem = { ...item, x, y: thisY, w, h };
                x = (x + 6) % 12;
                if (x === 0) {
                    y += 10;
                }
                layoutItems.push(layoutItem);
                first = false;
                i++;
            }

            return layoutItems;
        }
        const allEqualItems: LayoutItem[] = setEqualItems([
            {
                component: 'ConditionSelector',
                displayName: 'Condition Selector',
                id: 'ConditionSelector',
                icon: 'apps',
                noPadding: true,
            },
            {
                component: 'ExemplarView',
                displayName: 'Exemplar View',
                id: 'ExemplarView',
                icon: 'location_on',
                noPadding: true,
                hideOverflow: true,
                sidebar: 'ExemplarViewSettingsSidebar',
                toolbar: 'ExemplarViewSettingsToolbar',
            },
            {
                component: 'LooneageViewGL',
                displayName: 'Looneage',
                id: 'LooneageViewGL',
                icon: 'account_tree',
                noPadding: true,
                hideOverflow: true,
                sidebar: 'LooneageViewSettingsSidebar',
                toolbar: 'LooneageViewSettingsToolbar',
            },
            {
                component: 'AggregateLineChart',
                displayName: 'Line Chart',
                id: 'AggregateLineChart',
                icon: 'timeline',
                sidebar: 'AggregateLineChartSettingsSidebar',
                toolbar: 'AggregateLineChartSettingsToolbar',
                noPadding: true,
            },
            {
                component: 'SimpleTable',
                displayName: 'Lineages',
                id: 'SimpleTable-lineage',
                props: {
                    attributeLevel: 'lineage',
                },
                icon: 'table_chart',
                noPadding: true,
            },
            {
                component: 'ImageViewer',
                displayName: 'Images',
                id: 'ImageViewer',
                noPadding: true,
                hideOverflow: true,
                icon: 'image',
                sidebar: 'ImageViewerSettingsSidebar',
                toolbar: 'ImageViewerSettingsToolbar',
            },
            {
                component: 'SimpleTable',
                displayName: 'Tracks',
                id: 'SimpleTable-track',
                props: {
                    attributeLevel: 'track',
                },
                icon: 'table_chart',
                noPadding: true,
            },
            {
                component: 'SimpleTable',
                displayName: 'Cells',
                id: 'SimpleTable-cell',
                props: {
                    attributeLevel: 'cell',
                },
                icon: 'table_chart',
                noPadding: true,
            },
            {
                component: 'TrrackVisWrapper',
                displayName: 'History',
                id: 'TrrackVisWrapper',
                icon: 'history',
                noPadding: true,
            },
        ]);

        const defaultId = 'system_layout_0';

        // const smallImageLayout: Layout = {
        //     name: 'Small Image',
        //     editable: false,
        //     editing: false,
        //     id: defaultId,
        //     initialItems: cloneDeep(smallImageItems),
        //     currentItems: cloneDeep(smallImageItems),
        // };
        // const largeImageLayout: Layout = {
        //     name: 'Large Image',
        //     editable: false,
        //     editing: false,
        //     id: 'system_layout_1',
        //     initialItems: cloneDeep(largeImageItems),
        //     currentItems: cloneDeep(largeImageItems),
        // };

        const allEqualLayout: Layout = {
            name: 'Default',
            editable: false,
            editing: false,
            id: defaultId,
            initialItems: cloneDeep(allEqualItems),
            currentItems: cloneDeep(allEqualItems),
        };

        const currentLayoutId = useStorage<string>(
            'currentLayoutId',
            defaultId
        );

        const systemLayoutOptions = ref<Layout[]>([
            // smallImageLayout,
            // largeImageLayout,
            allEqualLayout,
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
