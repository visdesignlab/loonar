import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from '@vueuse/core';

export interface SettingsPage {
    // properties expected by a gridstack item
    name: string;
    faKey: string;
    id: string;
    show: boolean;
    component: string;
}

export const useGlobalSettings = defineStore('globalSettings', () => {
    const settingsPages = ref<SettingsPage[]>([
        {
            name: 'Select Dataset Location',
            faKey: 'fa-database',
            id: uuidv4(),
            show: false,
            component: 'DatasetSelector',
        },
        {
            name: 'Layout Configuration',
            faKey: 'fa-table-cells-large',
            id: uuidv4(),
            show: false,
            component: 'LayoutSelector',
        },
        {
            name: 'Settings',
            faKey: 'fa-gear',
            id: uuidv4(),
            show: false,
            component: 'GeneralSettings',
        },
        {
            name: 'Filter Data',
            faKey: 'fa-filter',
            id: uuidv4(),
            show: false,
            component: 'StubView',
        },
        {
            name: 'Search',
            faKey: 'fa-magnifying-glass',
            id: uuidv4(),
            show: false,
            component: 'StubView',
        },
    ]);

    const activePageIndex = ref<number | null>(null);
    const activePage = computed<SettingsPage | null>(() => {
        if (activePageIndex.value == null) return null;
        return settingsPages.value[activePageIndex.value];
    });
    const lastActivePageIndex = ref<number>(0);
    const lastActivePage = computed<SettingsPage>(() => {
        return settingsPages.value[lastActivePageIndex.value];
    });
    function toggleShown(setting: SettingsPage): void {
        if (setting.show) {
            setting.show = false;

            activePageIndex.value = null;
        } else {
            for (const s of settingsPages.value) {
                s.show = false;
            }
            setting.show = true;
            activePageIndex.value = settingsPages.value.findIndex(
                (page) => page.id === setting.id
            );
            lastActivePageIndex.value = activePageIndex.value;
        }
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
        usingMac,
    };
});
