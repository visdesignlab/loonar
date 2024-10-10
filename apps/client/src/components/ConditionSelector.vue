<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const globalSettings = useGlobalSettings();
</script>

<template>
    <div class="flex items-center justify-center align-center h-100">
        <q-card
            bordered
            :dark="globalSettings.darkMode"
            class="q-ma-sm inner-card"
        >
        </q-card>
    </div>
</template>

<style scoped lang="scss">
.inner-card {
    border-radius: 30px;
}
</style>
