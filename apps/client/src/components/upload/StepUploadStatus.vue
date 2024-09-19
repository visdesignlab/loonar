<script setup lang="ts">
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import LoadingProgress from '@/components/upload/LoadingProgress.vue';
import { router } from '@/router';
const uploadStore = useUploadStore();
function returnHome(): void {
    router.push('/');
}
function addNewExperiment(): void {
    uploadStore.resetState();
}
</script>

<template>
    <div class="column">
        <div class="row" style="justify-content: space-between">
            <span class="text-h4" style="font-weight: bold">
                Finish Creating Your Experiment</span
            >
        </div>
    </div>
    <div class="row q-pa-md" style="justify-content: space-between">
        <div class="column" style="flex: 0.65; border-right: 1px solid #dcdcdc">
            <span class="q-pa-sm" style="font-size: 1.5em"
                >Uploading and Processing Progress</span
            >
            <div class="q-pa-sm">
                <div class="q-pa-sm">
                    <LoadingProgress
                        :progress-status="uploadStore.progressStatusList"
                    />
                </div>
            </div>
        </div>
        <div
            class="column"
            style="
                flex: 1;
                margin-left: 30px;
                justify-content: center;
                align-items: center;
            "
        >
            <template
                v-if="
                    uploadStore.overallProgress.status !== 2 &&
                    uploadStore.overallProgress.status !== -1
                "
            >
                <q-banner inline-actions class="text-white bg-blue">
                    Your data is currently being processed. Please do not exit
                    this page.
                    <template v-slot:avatar>
                        <q-icon name="mdi-alert" color="white" />
                    </template>
                </q-banner>
            </template>
            <template v-else-if="uploadStore.overallProgress.status === -1">
                <q-banner inline-actions class="text-white bg-red">
                    There was an error in one or more processing steps. Your
                    experiment will need to be re-uploaded.
                    <template v-slot:avatar>
                        <q-icon name="mdi-alert-circle-outline" color="white" />
                    </template>
                </q-banner>
            </template>
            <template v-else>
                <q-banner class="text-white bg-green">
                    All your data has been processed and your experiment has
                    been successfully added. You can now navigate away from this
                    page.
                    <template v-slot:avatar>
                        <q-icon name="mdi-check-circle" color="white" />
                    </template>
                    <template v-slot:action>
                        <q-btn
                            flat
                            color="white"
                            label="Return to Home"
                            @click="returnHome()"
                        />
                        <q-btn
                            flat
                            color="white"
                            label="Add another experiment"
                            @click="addNewExperiment()"
                        />
                    </template>
                </q-banner>
            </template>
        </div>
    </div>
</template>

<style scoped lang="scss"></style>
@/stores/data/uploadStore
