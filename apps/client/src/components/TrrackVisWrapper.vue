<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import {
    useGlobalSettings,
    type SettingsPage,
} from '@/stores/componentStores/globalSettingsStore';
import { useProvenanceStore } from '@/stores/misc/provenanceStore';
import { ProvVisCreator } from '@trrack/vis-react';
import type { NodeId } from '@trrack/core';
const globalSettings = useGlobalSettings();

const { darkMode } = storeToRefs(globalSettings);
const provenanceStore = useProvenanceStore();
const trrackVisContainer = ref<Element | null>(null);

// Store this somewhere. Maybe local storage?
const bookmarkedNodes: NodeId[] = [];

onMounted(() => {
    createTrackVis();
});

// Setter function to add/remove a node from bookmark list
// This is passed to bookmarkNode in TrrackVis config
const bookmarkNodeCallback = (nodeId: NodeId) => {
    const idx = bookmarkedNodes.indexOf(nodeId);

    if (idx === -1) {
        bookmarkedNodes.push(nodeId);
    } else {
        bookmarkedNodes.splice(idx, 1);
    }
};

// Getter function to check if a node is bookmarked
// This is passed to isBookmarked in TrrackVis config
const isBookmarkedCallback = (id: NodeId) => {
    return bookmarkedNodes.includes(id);
};

function createTrackVis(): void {
    if (trrackVisContainer.value) {
        ProvVisCreator(
            trrackVisContainer.value,
            provenanceStore.provenance as any,
            {
                isBookmarked: isBookmarkedCallback,
                bookmarkNode: bookmarkNodeCallback,
                isDarkMode: darkMode.value,
            }
        );
    }
}

watch(darkMode, () => {
    createTrackVis();
});
</script>

<template>
    <div
        ref="trrackVisContainer"
        id="trrackVisContainer"
        class="d-flex flex-center"
    ></div>
</template>

<style lang="scss">
#trrackVisContainer > div {
    // overwrite the trrack styles to get scrollbar where I want it to be
    overflow: hidden !important;
}
</style>
