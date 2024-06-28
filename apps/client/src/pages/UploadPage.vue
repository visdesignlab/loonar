<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import StepExperimentMetadata from '@/components/upload/StepExperimentMetadata.vue';
import StepFileSelection from '@/components/upload/StepFileSelection.vue';
import StepReview from '@/components/upload/StepReview.vue';
import StepUploadStatus from '@/components/upload/StepUploadStatus.vue';
import type { QStepper } from 'quasar';
import { useUploadStore } from '@/stores/uploadStore';
import { useConfigStore } from '@/stores/configStore';
import GlobalSettingsView from '@/components/globalSettings/GlobalSettingsView.vue';

import { router } from '@/router';
const uploadStore = useUploadStore();
const configStore = useConfigStore();


interface LocationSettings {
    id: string;
    dataFrameFileName: string;
    imageDataFileName: string;
    segmentationsFolder: string;
}

const step = ref(1);
const experimentName = ref<string>('');
const numberOfLocations = ref<number>(1);

// Function to determine if the create experiment button should be enabled.
const disableUpload = () => {
    return !(stepDone(1) && stepDone(2));
};
// Function to determine if a step has been completed.
const stepDone = (inputStep: number) => {
    switch (inputStep) {
        case 1:
            return step.value > 1;
        case 2:
            return uploadStore.allFilesPopulated();
        default:
            return true;
    }
};
const returnHome = () =>{
    router.push('/');
}
</script>
<template>
    <q-page class="q-pa-lg q-gutter-md" style="max-width: 1200px; margin: auto">
        <template v-if="configStore.environment==='local'">
            <!-- <div class="vh-100 sticky-top">
                <GlobalSettingsView></GlobalSettingsView>
            </div> -->
            <q-banner inline-actions class="text-white bg-red">
                The local version of the Loon application does not support data upload directly.
                <template v-slot:action>
                    <q-btn flat color="white" label="Return to Home" @click="returnHome()"/>
                </template>
            </q-banner>
        </template>
        <template v-else-if="!uploadStore.experimentCreated">
            <q-stepper
                v-model="step"
                ref="stepper"
                color="primary"
                animated
                keep-alive
                header-nav
            >
                <q-step
                    :name="1"
                    title="Create New Experiment"
                    icon="settings"
                    :done="stepDone(1)"
                    done-color="green"
                >
                    <StepExperimentMetadata
                        v-model:experimentName="experimentName"
                        v-model:numberOfLocations="numberOfLocations"
                    />
                </q-step>
                <q-step
                    :name="2"
                    title="Select Files"
                    icon="settings"
                    :done="stepDone(2)"
                    done-color="green"
                >
                    <StepFileSelection />
                </q-step>

                <q-step title="Review" :name="5" icon="settings">
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
                            v-if="step > 1"
                            flat
                            color="primary"
                            @click="($refs.stepper as any).previous()"
                            label="Back"
                            class="q-ml-sm"
                        />
                        <q-btn
                            @click="
                                step === 5
                                    ? uploadStore.uploadAll()
                                    : ($refs.stepper as any).next()
                            "
                            color="primary"
                            :label="
                                step === 5 ? 'Begin Processing' : 'Continue'
                            "
                            :disabled="step === 5 ? disableUpload() : false"
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

<style scoped>
.upload-label {
    font-weight: bold;
}

.step-title {
    font-weight: bold;
    font-size: 1.2em;
}

.suggested {
    cursor: pointer;
    font-style: italic;
    font-weight: bold;
}

.suggested:hover {
    text-decoration: underline;
}
</style>
