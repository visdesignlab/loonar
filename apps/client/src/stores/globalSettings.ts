import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from '@vueuse/core';
import { router } from '@/router';

export interface SettingsPage {
    // properties expected by a gridstack item
    name: string;
    faKey: string;
    id: string;
    show: boolean;
    component?: string;
    url?: string;
    disableSidebar?:boolean;
}

export const useGlobalSettings = defineStore('globalSettings', () => {
    const settingsPages = ref<SettingsPage[]>([
        {
            name: 'Select Dataset Location',
            faKey: 'fa-database',
            id: uuidv4(),
            show: true,
            component: 'DatasetSelector',
            url: '/',
        },
        {
            name: 'Layout Configuration',
            faKey: 'fa-table-cells-large',
            id: uuidv4(),
            show: false,
            component: 'LayoutSelector',
            url: '/',
        },
        {
            name: 'Settings',
            faKey: 'fa-gear',
            id: uuidv4(),
            show: false,
            component: 'GeneralSettings',
            url: '/',
        },
        {
            name: 'Upload',
            faKey: 'fa-upload',
            id: uuidv4(),
            show: false,
            url: '/upload',
            disableSidebar:true
        },
        // {
        //     name: 'Filter Data',
        //     faKey: 'fa-filter',
        //     id: uuidv4(),
        //     show: false,
        //     component: 'StubView',
        // },
        // {
        //     name: 'Search',
        //     faKey: 'fa-magnifying-glass',
        //     id: uuidv4(),
        //     show: false,
        //     component: 'StubView',
        // },
    ]);

    const activePageIndex = ref<number | null>(0);
    const activePage = computed<SettingsPage | null>(() => {
        if (activePageIndex.value == null) return null;
        return settingsPages.value[activePageIndex.value];
    });
    const lastActivePageIndex = ref<number>(0);
    const lastActivePage = computed<SettingsPage>(() => {
        return settingsPages.value[lastActivePageIndex.value];
    });
    function toggleShown(setting: SettingsPage): void {
        if (setting.url) {
            router.push(setting.url);

            activePageIndex.value = null;
        }
        if (setting.show) {
            setting.show = false;

            activePageIndex.value = null;
        } else {
            //Sets all to false
            for (const s of settingsPages.value) {
                s.show = false;
            }
            // Sets single chosen to true
            setting.show = true;
            // Gets active index
            activePageIndex.value = settingsPages.value.findIndex(
                (page) => page.id === setting.id
            );
            lastActivePageIndex.value = activePageIndex.value;
        }
    }

    function showSetting(name: string): void {
        let setting: SettingsPage | null = null;
        for (const s of settingsPages.value) {
            s.show = false;
            if (s.name === name) {
                setting = s;
            }
        }
        if (setting === null) return;
        setting.show = true;
        activePageIndex.value = settingsPages.value.findIndex(
            (page) => page.id === setting!.id
        );
        lastActivePageIndex.value = activePageIndex.value;
    }

    function toggleLastActive(): void {
        toggleShown(lastActivePage.value);
    }

    const darkMode = useStorage<boolean>('darkMode', false);
    const btnLight = computed<string>(() => {
        // dark and light should be inverted depending on
        // if we are in dark mode or not.
        return normalizedLight.value;
    });
    // btnDark/btnLight are redundant and could be removed
    const btnDark = computed<string>(() => {
        return normalizedDark.value;
    });

    const normalizedDark = computed<string>(() => {
        return darkMode.value ? 'light' : 'dark';
    });
    const normalizedLight = computed<string>(() => {
        return darkMode.value ? 'dark' : 'light';
    });

    const normalizedBlack = computed<string>(() => {
        return darkMode.value ? 'white' : 'black';
    });

    const usingMac = computed<boolean>(() => {
        return navigator.userAgent.toLowerCase().includes('mac');
    });

    const normalizedSelectedHex = computed<string>(() => {
        return darkMode.value ? '#fde309' : '#E29609';
    });

    const normalizedSelectedRgb = computed<[number, number, number]>(() => {
        return darkMode.value ? [253, 227, 9] : [226, 150, 9];
    });

    const normalizedSelectedRgba = computed<[number, number, number, number]>(
        () => {
            return darkMode.value ? [253, 227, 9, 255] : [226, 150, 9, 255];
        }
    );

    // settings open/close state
    const settingsAccordion = ref({
        general: true,
        LooneageViewSettingsSidebar: false,
        ImageViewerSettingsSidebar: false,
        AggregateLineChartSettingsSidebar: false,
    });

    function openComponentSetting(key: string): void {
        for (const k in settingsAccordion.value) {
            // @ts-ignore
            settingsAccordion.value[k] = false;
        }
        // @ts-ignore
        settingsAccordion.value[key] = true;
        showSetting('Settings');
    }

    return {
        settingsPages,
        activePage,
        activePageIndex,
        toggleShown,
        toggleLastActive,
        darkMode,
        btnLight,
        btnDark,
        normalizedBlack,
        normalizedDark,
        normalizedLight,
        normalizedSelectedHex,
        normalizedSelectedRgb,
        normalizedSelectedRgba,
        usingMac,
        settingsAccordion,
        openComponentSetting,
        showSetting,
    };
});
