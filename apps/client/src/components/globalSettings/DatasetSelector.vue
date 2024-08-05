<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useGlobalSettings } from '@/stores/globalSettings';
import { useDatasetSelectionTrrackedStore } from '@/stores/datasetSelectionTrrackedStore';
import { useDatasetSelectionStore } from '@/stores/datasetSelectionStore';
import { useDataPointSelection } from '@/stores/dataPointSelection';

const globalSettings = useGlobalSettings();
const datasetSelectionStore = useDatasetSelectionStore();
const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
const dataPointSelection = useDataPointSelection();
const $q = useQuasar();

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
    // console.log('clicked location: ', location);
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

function openExampleDataset() {
    datasetSelectionTrrackedStore.serverUrl =
        'apps.vdl.sci.utah.edu/aardvark-s3';

    datasetSelectionTrrackedStore.currentExperimentFilename = 'Example_1.json';
    datasetSelectionTrrackedStore.selectedLocationIds['loc_4_well_23'] = true;
}
</script>

<template>
    <q-btn
        outline
        rounded
        class="full-width q-mb-md"
        @click="openExampleDataset"
        >Load Example Dataset</q-btn
    >
    <div style="display: flex; flex-direction: row">
        <q-select
            label="Experiment"
            v-model="datasetSelectionTrrackedStore.currentExperimentFilename"
            :display-value="shortExpName"
            :options="datasetSelectionStore.experimentFilenameList"
            :dark="globalSettings.darkMode"
            style="flex: 1"
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
