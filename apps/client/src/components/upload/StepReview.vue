<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUploadStore } from '@/stores/uploadStore';
const uploadStore = useUploadStore();
</script>

<template>
    <div class="column" style="margin-bottom: 50px">
        <span
            class="step-title q-pa-sm"
            style="border-bottom: 1px solid #dcdcdc"
            >Review Experiment</span
        >
        <span class="q-pa-sm" style="padding-top: 20px"
            ><span class="text-weight-bold">Experiment Name: </span
            ><span style="font-style: italic">{{
                uploadStore.experimentName
            }}</span></span
        >
        <span
            class="q-pa-sm"
            style="padding-bottom: 20px; border-bottom: 1px solid #dcdcdc"
            ><span class="text-weight-bold">Number of Locations: </span
            ><span style="font-style: italic">{{
                uploadStore.numberOfLocations
            }}</span></span
        >

        <div
            v-for="(locationFiles, index) in uploadStore.locationFileList"
            @key="index"
            class="column"
            style="padding-bottom: 20px; border-bottom: 1px solid #dcdcdc"
        >
            <span
                class="step-title q-pa-sm"
                style="font-size: 1.3em; margin-top: 20px"
                >ID: {{ locationFiles.locationId }}</span
            >
            <span class="q-pa-sm"
                ><span class="text-weight-bold">Data Frame CSV: </span
                ><span style="font-style: italic">{{
                    locationFiles.table.file?.name
                }}</span></span
            >
            <span class="q-pa-sm"
                ><span class="text-weight-bold">Cell Images: </span
                ><span style="font-style: italic">{{
                    locationFiles.images.file?.name
                }}</span></span
            >
            <span class="q-pa-sm"
                ><span class="text-weight-bold">Segmentations: </span
                ><span style="font-style: italic">{{
                    locationFiles.segmentations.file?.name
                }}</span></span
            >
        </div>
    </div>
</template>

<style scoped lang="scss"></style>
