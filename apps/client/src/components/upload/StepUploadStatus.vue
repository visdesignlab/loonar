<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUploadStore } from '@/stores/uploadStore';
import LoadingProgress from '@/components/upload/LoadingProgress.vue';
const uploadStore = useUploadStore();
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
            <span class="step-title q-pa-sm" style="font-size: 1.5em"
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
        <div class="column" style="flex: 1; margin-left: 30px">
            <q-btn @click="uploadStore.onSubmitExperiment"
                >Submit Experiment</q-btn
            >
        </div>
        <!-- <div class="column" style="flex: 1; margin-left: 30px">
            <q-form @submit="uploadStore.onSubmitExperiment">
                <div
                    class="row"
                    style="
                        justify-content: space-between;
                        margin-bottom: 20px;
                        align-items: center;
                    "
                >
                    <span class="step-title q-pa-sm" style="font-size: 1.5em">
                        Experiment Settings</span
                    >
                    <div class="row" style="display: block">
                        <q-btn color="danger" flat label="Cancel" no-caps />
                        <q-btn
                            color="primary"
                            label="Finish"
                            no-caps
                            type="submit"
                        />
                    </div>
                </div>
                <span class="step-title q-pa-sm">General</span>
                <div class="row">
                    <q-input
                        v-model="experimentName"
                        outlined
                        label-slot
                        disable
                        class="col-4 col-md-6 q-pa-sm"
                    >
                        <template v-slot:label>
                            <span class="upload-label">Experiment Name</span>
                        </template>
                    </q-input>
                    <q-input
                        v-model="numberOfLocations"
                        outlined
                        label-slot
                        disable
                        class="col-4 col-md-6 q-pa-sm"
                    >
                        <template v-slot:label>
                            <span class="upload-label"
                                >Number Of Locations</span
                            >
                        </template>
                    </q-input>
                </div>
                <template
                    v-for="(n, idx) in createRange(
                        numberOfLocations,
                        'metadata'
                    )"
                >
                    <div class="column" style="margin-top: 30px">
                        <span class="step-title q-pa-sm"
                            >Location {{ idx + 1 }}</span
                        >
                        <q-input
                            v-model="
                                experimentSettings[`location_${idx + 1}`].id
                            "
                            outlined
                            label-slot
                            class="col-4 col-md-6 q-pa-md"
                            bottom-slots
                            style="padding-bottom: 30px"
                            :rules="[(val) => !!val || 'Field is required']"
                        >
                            <template v-slot:label>
                                <span class="upload-label">ID</span>
                            </template>
                            <template v-slot:hint>
                                <div>
                                    Suggested:
                                    <span
                                        class="suggested"
                                        @click="
                                            handleSuggestedClick(
                                                idx + 1,
                                                'id',
                                                `location_${idx + 1}`
                                            )
                                        "
                                        >location_{{ idx + 1 }}</span
                                    >
                                </div>
                            </template>
                        </q-input>
                        <q-input
                            v-model="
                                experimentSettings[`location_${idx + 1}`]
                                    .dataFrameFileName
                            "
                            outlined
                            label-slot
                            class="col-4 col-md-6 q-pa-md"
                            :rules="[(val) => !!val || 'Field is required']"
                        >
                            <template v-slot:label>
                                <span class="upload-label"
                                    >Data Frame File Name</span
                                >
                            </template>
                        </q-input>
                        <q-input
                            v-model="
                                experimentSettings[`location_${idx + 1}`]
                                    .imageDataFileName
                            "
                            outlined
                            label-slot
                            class="col-4 col-md-6 q-pa-md"
                            :rules="[(val) => !!val || 'Field is required']"
                        >
                            <template v-slot:label>
                                <span class="upload-label"
                                    >Image Data File Name</span
                                >
                            </template>
                        </q-input>
                        <q-input
                            v-model="
                                experimentSettings[`location_${idx + 1}`]
                                    .segmentationsFolder
                            "
                            outlined
                            label-slot
                            class="col-4 col-md-6 q-pa-md"
                            :rules="[(val) => !!val || 'Field is required']"
                        >
                            <template v-slot:label>
                                <span class="upload-label"
                                    >Segmentations Folder</span
                                >
                            </template>
                        </q-input>
                    </div>
                </template>
            </q-form>
        </div> -->
    </div>
</template>

<style scoped lang="scss"></style>
