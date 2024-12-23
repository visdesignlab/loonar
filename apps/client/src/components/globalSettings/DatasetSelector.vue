<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';

import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

const globalSettings = useGlobalSettings();
const datasetSelectionStore = useDatasetSelectionStore();
const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
const $q = useQuasar();

const selectionStore = useSelectionStore();
const mosaicSelectionStore = useMosaicSelectionStore();
const conditionSelectorStore = useConditionSelectorStore();

watch(
    () => datasetSelectionStore.fetchingTabularData,
    () => {
        if (datasetSelectionStore.fetchingTabularData) {
            $q.loading.show({
                delay: 0,
            });
        } else {
            $q.loading.hide();
        }
    }
);

function onClickLocation(location: any) {
    datasetSelectionStore.selectImagingLocation(location);
}

const shortExpName = computed<string>(() => {
    let shortName = datasetSelectionTrrackedStore.currentExperimentFilename;
    if (shortName === null) return '';
    shortName = shortName.split('.')[0];
    const maxChar = 24;
    if (shortName.length > maxChar) {
        shortName = shortName.slice(0, maxChar) + '...';
    }
    return shortName;
});

function onSelectExperiment() {
    selectionStore.resetState();
    mosaicSelectionStore.resetState();
    conditionSelectorStore.resetState();
}
</script>

<template>
    <div class="flex row">
        <q-select
            label="Experiment"
            v-model="datasetSelectionTrrackedStore.currentExperimentFilename"
            :display-value="shortExpName"
            :options="datasetSelectionStore.experimentFilenameList"
            :dark="globalSettings.darkMode"
            class="flex-grow-1"
            @update:model-value="onSelectExperiment"
        />
        <q-btn
            flat
            icon="mdi-refresh"
            @click="datasetSelectionStore.refreshFileNameList"
        ></q-btn>
    </div>

    <div
        v-if="
            datasetSelectionStore.currentExperimentMetadata &&
            datasetSelectionStore.currentExperimentMetadata.locationMetadataList
                .length > 0
        "
        class="mt-3"
    >
        <span>Imaging Locations</span>
        <q-list bordered separator :dark="globalSettings.darkMode">
            <q-item
                v-for="location in datasetSelectionStore
                    .currentExperimentMetadata?.locationMetadataList"
                :key="location.id"
                clickable
                v-ripple
                :active="
                    datasetSelectionTrrackedStore.selectedLocationIds[
                        location.id
                    ]
                "
                active-class="bg-primary text-white"
                @click="
                    () => {
                        onClickLocation(location);
                    }
                "
                :dark="globalSettings.darkMode"
                ><q-item-section>{{ location.id }}</q-item-section></q-item
            >
        </q-list>
    </div>
</template>

<style scoped lange="scss"></style>
