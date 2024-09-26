<script setup lang="ts">
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import LoadingProgress from '@/components/upload/LoadingProgress.vue';
import LBanner from '@/components/custom/LBanner.vue';

const uploadStore = useUploadStore();
</script>

<template>
    <div class="column" style="justify-content: space-between">
        <div class="flex-row q-mt-md">
            <template
                v-if="
                    uploadStore.overallProgress.status !== 2 &&
                    uploadStore.overallProgress.status !== -1
                "
            >
                <l-banner
                    class="q-mb-md"
                    type="info"
                    message="Your data is currently being processed. Please do not exit
                    this page."
                />
            </template>
            <template v-else-if="uploadStore.overallProgress.status === -1">
                <l-banner
                    type="error"
                    message="There was an error in one or more processing steps. Your
                    experiment will need to be re-uploaded."
                />
            </template>
            <template v-else>
                <l-banner
                    class="q-mb-md"
                    type="success"
                    message="All your data has been processed and your experiment has
                    been successfully added. You can now navigate away from this
                    page."
                >
                </l-banner>
            </template>
        </div>
        <div class="flex-row q-mt-md">
            <div class="flex-column">
                <LoadingProgress :progress-status="uploadStore.progressList" />
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.my-banner {
    border: 5px solid blue;
    background-color: rgba(0, 0, 255, 0.6);
    border-radius: 20px;
}
</style>
