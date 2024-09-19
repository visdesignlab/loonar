<script setup lang="ts">
import { useUploadStore } from '@/stores/uploadStore';
import { useGlobalSettings } from '@/stores/globalSettings';
const uploadStore = useUploadStore();
const globalSettings = useGlobalSettings();
</script>

<template>
    <div>
        Select all files for the experiment. Location ID should be unique for
        each location. The table should be a CSV file. The images for a single
        location should be in a .zip files. The segmentations for a single
        location should be in a .zip file.
    </div>
    <div
        v-for="(locationFile, index) in uploadStore.locationFileList"
        :key="index"
        class="row q-mt-lg q-gutter-sm"
    >
        <q-input
            class="flex-grow-1"
            outlined
            v-model="locationFile.locationId"
            label="Location ID"
            :dark="globalSettings.darkMode"
        />
        <q-file
            class="flex-grow-1"
            outlined
            v-model="locationFile.table.file"
            label="Table (csv)"
            :dark="globalSettings.darkMode"
            @update:model-value="uploadStore.populateDefaultColumnMappings"
        />

        <q-file
            class="flex-grow-1"
            outlined
            v-model="locationFile.images.file"
            label="Images (zip)"
            :dark="globalSettings.darkMode"
        />
        <q-file
            class="flex-grow-1"
            outlined
            v-model="locationFile.segmentations.file"
            label="Segmentations (zip)"
            :dark="globalSettings.darkMode"
        />
        <q-btn
            @click="uploadStore.removeLocation(index)"
            icon="delete"
            title="Remove Location"
            outline
            :dark="globalSettings.darkMode"
        />
    </div>

    <q-btn
        class="q-mt-lg"
        @click="uploadStore.addLocation"
        label="Add Location"
        outline
    />

    <q-banner
        v-if="!uploadStore.locationIdsUnique()"
        class="q-mt-sm text-white bg-red"
        >Location IDs must be Unique.</q-banner
    >
</template>

<style scoped lang="scss"></style>
@/stores/data/uploadStore @/stores/componentStores/globalSettings
