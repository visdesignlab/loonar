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
                    uploadStore.overallProgress.status === 'not_started' || uploadStore.overallProgress.status === 'running'
                "
            >
                <l-banner
                    class="q-mb-md"
                    type="info"
                    :message="uploadStore.overallProgress.message"
                />
            </template>
            <template v-else-if="uploadStore.overallProgress.status === 'failed'">
                <l-banner
                    type="error"
                    class="q-mb-md"
                    :message="uploadStore.overallProgress.message"
                />
            </template>
            <template v-else>
                <l-banner
                    class="q-mb-md"
                    type="success"
                    :message="uploadStore.overallProgress.message"
                />
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
</style>
