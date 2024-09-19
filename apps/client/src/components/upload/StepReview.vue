<script setup lang="ts">
import { useUploadStore } from '@/stores/componentStores/uploadStore';
const uploadStore = useUploadStore();
</script>

<template>
    <div class="q-mb-md">
        <div class="q-mb-md">
            <span class="text-weight-bold">Experiment Name: </span
            ><span class="text-italic">{{ uploadStore.experimentName }}</span>
        </div>
        <div class="q-mb-md">
            <span class="text-weight-bold">Number of Locations: </span
            ><span class="text-italic">{{
                uploadStore.numberOfLocations
            }}</span>
        </div>
        <q-separator class="q-mb-sm" />
        <div
            v-for="(locationFiles, index) in uploadStore.locationFileList"
            :key="index"
        >
            <div class="q-mb-md q-pt-none text-h5">
                Location: {{ locationFiles.locationId }}
            </div>
            <div class="q-mb-md">
                <span class="text-weight-bold">Data Frame CSV: </span
                ><span class="text-italic">{{
                    locationFiles.table.file?.name
                }}</span>
            </div>
            <div class="q-mb-md">
                <span class="text-weight-bold">Cell Images: </span
                ><span class="text-italic">{{
                    locationFiles.images.file?.name
                }}</span>
            </div>
            <div class="q-mb-md">
                <span class="text-weight-bold">Segmentations: </span
                ><span class="text-italic">{{
                    locationFiles.segmentations.file?.name
                }}</span>
            </div>
            <q-separator
                v-if="index != uploadStore.locationFileList.length - 1"
                class="q-mb-sm"
            />
        </div>
    </div>
</template>

<style scoped lang="scss"></style>
@/stores/data/uploadStore
