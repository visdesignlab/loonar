<script setup lang="ts">
import { router } from '@/router';
import { useGlobalSettings } from '@/stores/globalSettings';
import { onKeyStroke } from '@vueuse/core';
import { ref } from 'vue';
const globalSettings = useGlobalSettings();
onKeyStroke(['b', 'B'], (e: KeyboardEvent) => {
    if (globalSettings.usingMac && !e.metaKey) return;
    if (!globalSettings.usingMac && !e.ctrlKey) return;
    globalSettings.toggleLastActive();
});

const tab = ref('Select Dataset Location');

const navigateToPage = (url:string|undefined) => {
    if(url){
        router.push(url);
    }
}
</script>

<template>
    <div class="d-flex h-100 ps-1 pt-1 pb-1">
      <q-tabs
        v-model="tab"
        vertical
        class="fixed-width-tabs justify-content-start"
      >
        <template v-for="setting in globalSettings.settingsPages" :key="setting.name">
            <q-tab :name="setting.name" @click="navigateToPage(setting.url)">
                <template v-slot:default>
                    <div class="d-flex align-items-center">
                        <font-awesome-icon :icon="`fa-solid ${setting.faKey}`" style="height:1.3em;" />
                    </div>
                </template>
            </q-tab>
        </template>
      </q-tabs>
  
      <q-tab-panels
        v-model="tab"
        class="fixed-width-panels"
        :dark="globalSettings.darkMode"
        swipeable
        vertical
        style="margin-left:5px;"
      >
        <template v-for="setting in globalSettings.settingsPages" :key="setting.name">
          <q-tab-panel :name="setting.name" style="border: 1px solid rgba(0,0,0,0.12);border-radius:4px;">
            <div v-if="globalSettings.activePage != null && !globalSettings.activePage.disableSidebar">
              <h5>{{ setting.name }}</h5>
              <hr />
              <component :is="setting.component"></component>
            </div>
          </q-tab-panel>
        </template>
      </q-tab-panels>
    </div>
  </template>
  

<style scoped lang="scss">
$panel-width: 300px;

.flex-grow-0 {
    flex-grow: 0;
}

.fixed-width-panels{
    width:300px;
    margin-top:3px;
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

