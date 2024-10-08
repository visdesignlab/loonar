<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const globalSettings = useGlobalSettings();
</script>

<template>
    <q-list>
        <q-expansion-item
            group="settings"
            icon="public"
            label="General"
            v-model="globalSettings.settingsAccordion['general']"
        >
            <q-card :dark="globalSettings.darkMode">
                <q-card-section>
                    <q-toggle
                        v-model="globalSettings.darkMode"
                        checked-icon="mdi-weather-night"
                        color="blue"
                        unchecked-icon="mdi-weather-sunny"
                        label="Toggle Dark Mode"
                    />
                </q-card-section>
            </q-card>
        </q-expansion-item>

        <q-separator />

        <q-expansion-item
            group="settings"
            icon="image"
            label="Images"
            v-model="
                globalSettings.settingsAccordion['ImageViewerSettingsSidebar']
            "
        >
            <q-card :dark="globalSettings.darkMode">
                <q-card-section>
                    <ImageViewerSettingsSidebar />
                </q-card-section>
            </q-card>
        </q-expansion-item>
        <q-separator />

        <q-expansion-item
            group="settings"
            icon="account_tree"
            label="Looneage"
            v-model="
                globalSettings.settingsAccordion['LooneageViewSettingsSidebar']
            "
        >
            <q-card :dark="globalSettings.darkMode">
                <q-card-section>
                    <LooneageViewSettingsSidebar />
                </q-card-section>
            </q-card>
        </q-expansion-item>
        <q-separator />

        <q-expansion-item
            group="settings"
            icon="timeline"
            label="Line Chart"
            v-model="
                globalSettings.settingsAccordion[
                    'AggregateLineChartSettingsSidebar'
                ]
            "
        >
            <q-card :dark="globalSettings.darkMode">
                <q-card-section>
                    <AggregateLineChartSettingsSidebar />
                </q-card-section>
            </q-card>
        </q-expansion-item>
    </q-list>
</template>

<style scoped lange="scss"></style>
