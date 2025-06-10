import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { useRouter } from 'vue-router';

export interface SettingsPage {
    // properties expected by a gridstack item
    name: string;
    faKey: string;
    id: number;
    show: boolean;
    component?: string;
    url?: string;
    disableSidebar?: boolean;
}

export const useGlobalSettings = defineStore('globalSettings', () => {
    const settingsPages = ref<SettingsPage[]>([
        {
            name: 'Select Dataset',
            faKey: 'fa-database',
            id: 1,
            show: true,
            component: 'DatasetSelector',
            url: '/',
        },
        {
            name: 'Layout Configuration',
            faKey: 'fa-table-cells-large',
            id: 2,
            show: false,
            component: 'LayoutSelector',
            url: '/',
        },
        {
            name: 'Settings',
            faKey: 'fa-gear',
            id: 3,
            show: false,
            component: 'GeneralSettings',
            url: '/',
        },
        {
            name: 'Filter Data',
            faKey: 'fa-filter',
            id: 4,
            show: false,
            component: 'FilterSelector',
        },
        // {
        //     name: 'Search',
        //     faKey: 'fa-magnifying-glass',
        //     id: uuidv4(),
        //     show: false,
        //     component: 'StubView',
        // },
    ]);

    const router = useRouter();

    // Disables the sidebar on other pages
    const settingsVisible = computed<boolean>(() => {
        if (router.currentRoute.value.path === '/') {
            return true;
        }
        return false;
    });

    const tab = ref('Select Dataset');
    const activePageIndex = ref<number>(1);
    const lastActivePageIndex = ref<number>(0);
    const isPanelVisible = ref(true);
    function handleIconClick(setting: SettingsPage): void {
        if (setting.id == activePageIndex.value) {
            isPanelVisible.value = !isPanelVisible.value;
        } else {
            isPanelVisible.value = true;
        }
        lastActivePageIndex.value = activePageIndex.value;
        activePageIndex.value = setting.id;
    }

    function toggleShown(): void {
        isPanelVisible.value = !isPanelVisible.value;
    }

    function showSetting(name: string): void {
        tab.value = 'Settings';
        let setting: SettingsPage | null = null;
        for (const s of settingsPages.value) {
            s.show = false;
            if (s.name === name) {
                setting = s;
            }
        }
        if (setting === null) return;
        setting.show = true;
        activePageIndex.value = settingsPages.value.find(
            (setting: SettingsPage) => setting.name === 'Settings'
        )!.id;
        lastActivePageIndex.value = activePageIndex.value;
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
        ExemplarViewSettingsSidebar: false,
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
        handleIconClick,
        isPanelVisible,
        tab,
        toggleShown,
        settingsVisible,
    };
});
