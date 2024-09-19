<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import StepExperimentMetadata from '@/components/upload/StepExperimentMetadata.vue';
import StepFileSelection from '@/components/upload/StepFileSelection.vue';
import StepReview from '@/components/upload/StepReview.vue';
import StepUploadStatus from '@/components/upload/StepUploadStatus.vue';
import StepColumnNameMapping from '@/components/upload/StepColumnNameMapping.vue';
import type { QStepper } from 'quasar';
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import { useConfigStore } from '@/stores/misc/configStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useQuasar } from 'quasar';

import { router } from '@/router';
const uploadStore = useUploadStore();
const configStore = useConfigStore();
const globalSettings = useGlobalSettings();
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
    return uploadStore.allFilesPopulated() && uploadStore.locationIdsUnique();
}

function columnNameMappingDone(): boolean {
    return uploadStore.allColumnsMapped();
}

function returnHome(): void {
    router.push('/');
}

const $q = useQuasar();

async function handleNextStep(): Promise<void> {
    if (uploadStore.step === 'finalReview' || uploadStore.step === 'metadata') {
        const verifyExperimentName = await uploadStore.verifyExperimentName();
        if (verifyExperimentName) {
            uploadStore.experimentNameValid = true;
            if (uploadStore.step === 'metadata') {
                (stepper.value as any).next();
            } else {
                uploadStore.uploadAll();
            }
        } else {
            $q.notify({
                color: 'negative',
                message: 'Experiment Name already in use.',
                icon: 'report_problem',
                position: 'top',
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
        <template v-else-if="!uploadStore.experimentCreated">
            <q-stepper
                v-model="uploadStore.step"
                ref="stepper"
                color="primary"
                animated
                keep-alive
                header-nav
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

                <q-step title="Review" name="finalReview" icon="settings">
                    <StepReview />
                </q-step>

                <template v-slot:navigation>
                    <q-stepper-navigation
                        style="
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                        "
                    >
                        <q-btn
                            v-if="uploadStore.step !== 'metadata'"
                            flat
                            color="primary"
                            @click="handlePreviousStep"
                            label="Back"
                            class="q-ml-sm"
                        />
                        <q-btn
                            @click="handleNextStep"
                            color="primary"
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
                    </q-stepper-navigation>
                </template>
            </q-stepper>
        </template>
        <template v-else>
            <StepUploadStatus />
        </template>
    </q-page>
</template>

<style scoped></style>
@/stores/initialization/configStore @/stores/data/uploadStore
@/stores/componentStores/globalSettings @/stores/misc/configStore
