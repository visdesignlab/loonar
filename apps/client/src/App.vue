<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { watch, onBeforeMount, ref } from 'vue';
import { useQuasar } from 'quasar';
import GlobalSettingsView from './components/globalSettings/GlobalSettingsView.vue';
import { useProvenanceStore } from '@/stores/misc/provenanceStore';
import { onKeyStroke } from '@vueuse/core';
import { router } from '@/router';
import LBtn from './components/custom/LBtn.vue';
import BasicInfoCounts from '@/components/BasicInfoCounts.vue';

const $q = useQuasar();
const provenanceStore = useProvenanceStore();

onKeyStroke(['z', 'Z'], (e: KeyboardEvent) => {
    if (globalSettings.usingMac && !e.metaKey) return;
    if (!globalSettings.usingMac && !e.ctrlKey) return;
    if (e.shiftKey) {
        e.preventDefault();
        if ($q.loading.isActive) return;
        provenanceStore.provenance.redo();
    } else {
        e.preventDefault();
        if ($q.loading.isActive) return;
        provenanceStore.provenance.undo();
    }
});

const globalSettings = useGlobalSettings();
watch(
    () => globalSettings.darkMode,
    (newDarkMode: boolean) => {
        setBsTheme(newDarkMode);
    }
);

function setBsTheme(darkMode: boolean): void {
    const htmlData = document.documentElement.dataset;
    if (darkMode) {
        htmlData.bsTheme = 'dark';
    } else {
        htmlData.bsTheme = 'light';
    }
}
onBeforeMount(() => {
    setBsTheme(globalSettings.darkMode);
    document.body.style.overflowY = 'unset';
    // ☝️ hack. quasar loading is forcing a y scroll on body which is causing
    // weird relayout issues when a loading screen is triggered. This prevents that.
    // there is still an awkward reset, but I can live with it.
});
</script>

<template>
    <q-layout view="hHh LpR fFf">
        <q-header
            :dark="globalSettings.darkMode"
            style="position: fixed"
            bordered
            :class="globalSettings.darkMode ? 'bg-grey-9' : 'bg-white'"
        >
            <q-toolbar>
                <q-toolbar-title class="row items-center no-wrap">
                    <span>Loon</span>
                    <BasicInfoCounts class="q-ml-sm" />
                </q-toolbar-title>
                <l-btn
                    @click="router.push('/')"
                    type="basic"
                    label="Home"
                    class="q-mr-sm"
                />
                <l-btn
                    @click="router.push('/upload')"
                    type="basic"
                    label="Upload"
                />
            </q-toolbar>
        </q-header>
        <GlobalSettingsView></GlobalSettingsView>
        <q-page-container>
            <q-page>
                <div class="d-flex flex-row">
                    <div class="flex-grow-1">
                        <router-view v-slot="{ Component }">
                            <keep-alive>
                                <component :is="Component" />
                            </keep-alive>
                        </router-view>
                    </div>
                </div>
            </q-page>
        </q-page-container>
    </q-layout>
</template>

<style>
.flex-grow-1 {
    flex-grow: 1;
}

.no-select {
    user-select: none;
}
</style>
