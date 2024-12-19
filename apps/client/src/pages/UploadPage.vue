<script lang="ts" setup>
import { ref } from 'vue';
import StepExperimentMetadata from '@/components/upload/StepExperimentMetadata.vue';
import StepFileSelection from '@/components/upload/StepFileSelection.vue';
import StepReview from '@/components/upload/StepReview.vue';
import StepUploadStatus from '@/components/upload/StepUploadStatus.vue';
import StepColumnNameMapping from '@/components/upload/StepColumnNameMapping.vue';
import type { QStepper } from 'quasar';
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import { useConfigStore } from '@/stores/misc/configStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useNotificationStore } from '@/stores/misc/notificationStore';
import LBtn from '@/components/custom/LBtn.vue';

import { router } from '@/router';
const uploadStore = useUploadStore();
const configStore = useConfigStore();
const globalSettings = useGlobalSettings();
const notificationStore = useNotificationStore();
const stepper = ref(null);

// Function to determine if the create experiment button should be enabled.
function disableUpload(): boolean {
    return !(
        experimentMetadataDone() &&
        fileSelectionDone() &&
        columnNameMappingDone()
    );
}

function experimentMetadataDone(): boolean {
    return uploadStore.experimentNameValid;
}

function fileSelectionDone(): boolean {
    return uploadStore.allFilesPopulated() && uploadStore.locationIdsUnique;
}

function columnNameMappingDone(): boolean {
    return uploadStore.allColumnsMapped();
}

function returnHome(): void {
    router.push('/');
}

function addNewExperiment(): void {
    uploadStore.resetState();
}

async function handleNextStep(): Promise<void> {
    if (uploadStore.step === 'finalReview' || uploadStore.step === 'metadata') {
        const verifyExperimentName = await uploadStore.verifyExperimentName();
        if (verifyExperimentName) {
            uploadStore.experimentNameValid = true;
            if (uploadStore.step === 'finalReview') {
                uploadStore.uploadAll();
            }
            (stepper.value as any).next();
        } else {
            notificationStore.notify({
                message: 'Experiment Name already in use.',
                type: 'problem',
            });
            uploadStore.experimentNameValid = false;
        }
    } else {
        (stepper.value as any).next();
    }
}

function handlePreviousStep(): void {
    (stepper.value as any).previous();
}
</script>
<template>
    <q-page
        class="q-pa-lg q-gutter-md"
        :dark="globalSettings.darkMode"
        style="max-width: 1200px; margin: auto"
    >
        <template v-if="configStore.environment === 'local'">
            <q-banner inline-actions class="text-white bg-red">
                The local version of the Loon application does not support data
                upload directly.
                <template v-slot:action>
                    <q-btn
                        flat
                        color="white"
                        label="Return to Home"
                        @click="returnHome()"
                    />
                </template>
            </q-banner>
        </template>
        <template v-else>
            <div class="row">
                <div class="row" style="justify-content: space-between">
                    <span class="text-h4">Uploading An Experiment</span>
                </div>
            </div>
            <div class="row"></div>
            <q-stepper
                v-model="uploadStore.step"
                ref="stepper"
                color="primary"
                animated
                flat
                bordered
                keep-alive
                :dark="globalSettings.darkMode"
            >
                <q-step
                    name="metadata"
                    title="Create New Experiment"
                    icon="settings"
                    :done="experimentMetadataDone()"
                    done-color="green"
                >
                    <StepExperimentMetadata />
                </q-step>
                <q-step
                    name="selectFiles"
                    title="Select Files"
                    icon="settings"
                    :done="fileSelectionDone()"
                    done-color="green"
                >
                    <StepFileSelection />
                </q-step>
                <q-step
                    name="defineColumns"
                    title="Define Column Variables"
                    icon="settings"
                    :done="columnNameMappingDone()"
                    done-color="green"
                >
                    <StepColumnNameMapping />
                </q-step>

                <q-step
                    title="Review"
                    name="finalReview"
                    icon="settings"
                    :done="uploadStore.step == 'uploading'"
                    done-color="green"
                >
                    <StepReview />
                </q-step>
                <q-step
                    title="Uploading"
                    name="uploading"
                    icon="upload"
                    :active-icon="
                        uploadStore.overallProgress.status == 'succeeded'
                            ? 'mdi-check'
                            : 'upload'
                    "
                    :active-color="
                        uploadStore.overallProgress.status == 'succeeded'
                            ? 'green'
                            : '#1976d2'
                    "
                    :done="uploadStore.overallProgress.status == 'succeeded'"
                >
                    <StepUploadStatus />
                </q-step>

                <template v-slot:navigation>
                    <q-stepper-navigation
                        style="
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                        "
                    >
                        <l-btn
                            v-if="
                                uploadStore.step !== 'metadata' &&
                                uploadStore.step !== 'uploading'
                            "
                            label="Back"
                            class="q-mr-sm"
                            @click="handlePreviousStep"
                            type="previous"
                        />
                        <l-btn
                            v-if="uploadStore.step !== 'uploading'"
                            @click="handleNextStep"
                            :label="
                                uploadStore.step === 'finalReview'
                                    ? 'Begin Processing'
                                    : 'Continue'
                            "
                            :disabled="
                                uploadStore.step === 'finalReview'
                                    ? disableUpload()
                                    : false
                            "
                        />
                        <l-btn
                            v-if="uploadStore.step == 'uploading'"
                            @click="returnHome"
                            label="Return To Home"
                            class="q-mr-sm"
                            :disabled="
                                uploadStore.overallProgress.status !==
                                'succeeded'
                            "
                            type="previous"
                        />
                        <l-btn
                            v-if="uploadStore.step == 'uploading'"
                            @click="addNewExperiment"
                            label="Create New Experiment"
                            :disabled="
                                uploadStore.overallProgress.status !==
                                'succeeded'
                            "
                        />
                    </q-stepper-navigation>
                </template>
            </q-stepper>
        </template>
    </q-page>
</template>

<style scoped></style>
