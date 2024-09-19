<script setup lang="ts">
import { ref } from 'vue';
import { onMounted } from 'vue';
import { GridStack } from 'gridstack';
import screenfull from 'screenfull';
import 'gridstack/dist/gridstack.min.css';
import { useGridstackLayoutStore } from '@/stores/gridstackLayoutStore';
import { useGlobalSettings } from '@/stores/globalSettings';
const globalSettings = useGlobalSettings();
const gridstackLayoutStore = useGridstackLayoutStore();
// useful reference
// https://stackoverflow.com/questions/72813397/gridstack-js-vue-3-components

let isFullScreen = ref(false);
let grid: GridStack | null = null; // DO NOT use ref(null) as proxies GS will break all logic when comparing structures... see https://github.com/gridstack/gridstack.js/issues/2115

onMounted(() => {
    // let args: GridStackOptions;
    grid = GridStack.init({
        // DO NOT user grid.value = GridStack.init(), see above
        float: true,
        cellHeight: '40px',
        minRow: 1,
        resizable: {
            handles: 'e,se,s,w',
        },
        draggable: {
            handle: '.drag-target',
        },
        margin: 7,
        disableOneColumnMode: true,
    });

    grid.on('change', (event: any, changeItems: any) => {
        // console.log('-------------------------------------------------');
        // console.log('grid.on change');
        if (changeItems == null) return;
        gridstackLayoutStore.$patch(() => {
            for (let changedItem of changeItems) {
                gridstackLayoutStore.updateItem(changedItem);
            }
        });
        // console.log({ changeItems });
    });
    // grid.on('dragstart', (event: Event, element: any, ...args: any[]) => {
    //     // console.log({ event, element, args });
    //     // event.preventDefault();
    // });
    // grid.on('dragstop', function (_event: any, element: any) {
    //     const node = element.gridstackNode;
    //     info = `you just dragged node #${node.id} to ${node.x},${node.y} – good job!`;
    // });
});

async function toggleFullscreen(elementId: string) {
    const element = document.getElementById(elementId);
    if (screenfull.isEnabled && element) {
        await screenfull.toggle(element);
        isFullScreen.value = screenfull.isFullscreen;
    }
}
</script>

<template>
    <div class="grid-stack">
        <div
            v-for="(w, index) in gridstackLayoutStore.currentLayout
                ?.currentItems"
            class="grid-stack-item"
            :gs-x="w.x"
            :gs-y="w.y"
            :gs-w="w.w"
            :gs-h="w.h"
            :gs-id="w.id"
            :id="w.id.toString()"
            :key="index"
        >
            <q-card
                flat
                :dark="globalSettings.darkMode"
                bordered
                class="grid-stack-item-content flex column no-wrap show-on-hover-parent"
                :id="`container-${w.id}`"
            >
                <q-toolbar dense>
                    <q-icon
                        v-if="!isFullScreen"
                        name="drag_indicator"
                        class="drag-target show-on-hover"
                    />
                    <q-btn
                        v-if="w.sidebar"
                        @click="
                            () =>
                                globalSettings.openComponentSetting(
                                    w.sidebar ?? ''
                                )
                        "
                        flat
                        round
                        dense
                        size="md"
                        icon="settings"
                    />
                    <q-icon v-if="w.icon" :name="w.icon" right />
                    <q-toolbar-title shrink class="text-body1 q-pl-xs">{{
                        w.displayName
                    }}</q-toolbar-title>
                    <component v-if="w.toolbar" :is="w.toolbar"></component>
                    <q-space />
                    <q-btn
                        flat
                        round
                        dense
                        @click="toggleFullscreen(`container-${w.id}`)"
                        :icon="isFullScreen ? 'fullscreen_exit' : 'fullscreen'"
                        class="show-on-hover"
                    />
                </q-toolbar>

                <q-card-section
                    :class="`${
                        w.noPadding ? 'q-pa-none' : ''
                    } scroll-y h-100 position-relative`"
                >
                    <component :is="w.component" v-bind="w.props"></component>
                </q-card-section>
            </q-card>
        </div>
    </div>
</template>
<style scoped lang="scss">
.drag-target {
    cursor: move;
}

.scroll-y {
    overflow-y: auto;
}

.show-on-hover {
    visibility: hidden;
}

.show-on-hover-parent:hover .show-on-hover {
    visibility: visible;
}
</style>
@/stores/componentStores/globalSettings
@/stores/userInteraction/gridstackLayoutStore
