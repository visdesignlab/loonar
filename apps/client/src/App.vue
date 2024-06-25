<script setup lang="ts">
import { useGlobalSettings } from '@/stores/globalSettings';
import { watch, onBeforeMount } from 'vue';
import { useQuasar } from 'quasar';
import GridstackLayout from './components/GridstackLayout.vue';
import GlobalSettingsView from './components/globalSettings/GlobalSettingsView.vue';
import { useProvenanceStore } from '@/stores/provenanceStore';
import { onKeyStroke } from '@vueuse/core';

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
    <q-layout>
        <q-page-container>
            <router-view/>
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
