<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { onKeyStroke } from '@vueuse/core';
const globalSettings = useGlobalSettings();
onKeyStroke(['b', 'B'], (e: KeyboardEvent) => {
    if (globalSettings.usingMac && !e.metaKey) return;
    if (!globalSettings.usingMac && !e.ctrlKey) return;
    globalSettings.toggleShown();
});
</script>

<template>
    <q-drawer
        v-model="globalSettings.settingsVisible"
        :width="globalSettings.isPanelVisible ? 360 : 70"
        side="left"
        :bordered="globalSettings.isPanelVisible"
        show-overlay
        behavior="desktop"
        :dark="globalSettings.darkMode"
    >
        <div class="flex row no-wrap full-height">
            <q-tabs
                v-model="globalSettings.tab"
                vertical
                class="fixed-width-tabs justify-content-start"
            >
                <template
                    v-for="setting in globalSettings.settingsPages"
                    :key="setting.name"
                >
                    <q-tab
                        :name="setting.name"
                        @click="globalSettings.handleIconClick(setting)"
                    >
                        <template v-slot:default>
                            <div class="d-flex align-items-center">
                                <font-awesome-icon
                                    :icon="`fa-solid ${setting.faKey}`"
                                    style="height: 1.3em"
                                />
                            </div>
                        </template>
                    </q-tab>
                </template>
            </q-tabs>
            <div class="overlow-x-hidden">
                <transition name="collapse">
                    <q-tab-panels
                        v-model="globalSettings.tab"
                        v-if="globalSettings.isPanelVisible"
                        class="fixed-width-panels flex-grow-1"
                        :dark="globalSettings.darkMode"
                        swipeable
                        vertical
                    >
                        <template
                            v-for="setting in globalSettings.settingsPages"
                            :key="setting.name"
                        >
                            <q-tab-panel :name="setting.name">
                                <div>
                                    <h5 class="q-mb-none">
                                        {{ setting.name }}
                                    </h5>
                                    <hr />
                                    <component
                                        :is="setting.component"
                                    ></component>
                                </div>
                            </q-tab-panel>
                        </template>
                    </q-tab-panels>
                </transition>
            </div>
        </div>
    </q-drawer>
</template>

<style scoped lang="scss">
$panel-width: 300px;

.overlow-x-hidden {
    overflow-x: hidden;
}

.flex-grow-0 {
    flex-grow: 0;
}
.flex-grow-1 {
    flex-grow: 1;
}

.fixed-width-panels {
    width: 300px;
    margin-top: 3px;
}

.settings-panel {
    width: $panel-width;
    position: relative;
    left: 0px;
    overflow: auto;
}

.slide-right-enter-active,
.slide-right-leave-active {
    transition: all 0.3s ease;
    left: 0px;
}

.slide-right-enter-from,
.slide-right-leave-to {
    opacity: 0.05;
    left: -$panel-width;
}
</style>
