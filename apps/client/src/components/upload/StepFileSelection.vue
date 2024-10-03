<script setup lang="ts">
import { ref } from 'vue';
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import LBtn from '../custom/LBtn.vue';
import LChip from '../custom/LChip.vue';
const uploadStore = useUploadStore();
const globalSettings = useGlobalSettings();

const currentLocationIndex = ref<number>(0);

function handleLocationIdInput(index: number) {
    currentLocationIndex.value = index;
}

const dialog = ref(false);

const tempTags = ref<[string, string][]>([['', '']]);

const openTagModal = (index: number) => {
    currentLocationIndex.value = index;
    tempTags.value = JSON.parse(JSON.stringify(uploadStore.tags[index]));
    dialog.value = true;
};

const closeTagModal = () => {
    tempTags.value = [['', '']];
    dialog.value = false;
};

// Saves current tags to the tags in upload store
const saveTags = () => {
    uploadStore.tags[currentLocationIndex.value] = JSON.parse(
        JSON.stringify(tempTags.value)
    );
    for (let i = 0; i < tempTags.value.length; i++) {
        if (!(tempTags.value[i][0] in uploadStore.tagColors)) {
            uploadStore.tagColors[tempTags.value[i][0]] =
                colors[currColorIndex.value];
            currColorIndex.value = (currColorIndex.value + 1) % colors.length;
        }
    }
    dialog.value = false;
};

// Add new tag key-value pair in dialog
const addTag = () => {
    tempTags.value.push(['', '']);
};

// Remove tag key-value pair in dialog
const removeTag = (idx: number) => {
    tempTags.value.splice(idx, 1);
};

const currColorIndex = ref<number>(0);
const colors = ['red', 'blue', 'orange', 'green', 'yellow', 'pink'];
</script>

<template>
    <div class="q-mb-lg">
        Select all files for the experiment. Location ID should be unique for
        each location. The table should be a CSV file. The images for a single
        location should be in a .zip files. The segmentations for a single
        location should be in a .zip file.
    </div>
    <div
        v-for="(locationFile, index) in uploadStore.locationFileList"
        :key="index"
        class="column q-mt-none q-gutter-sm"
    >
        <div class="row">
            <template
                v-for="(tag, tagIndex) in uploadStore.tags[index]"
                :key="tagIndex"
            >
                <l-chip
                    v-if="tag[0] !== ''"
                    :color="uploadStore.tagColors[tag[0]]"
                    :label="`${tag[0]}: ${tag[1]}`"
                />
            </template>
        </div>
        <div class="row gap-10">
            <q-input
                class="flex-grow-1"
                outlined
                v-model="locationFile.locationId"
                label="Location ID"
                :dark="globalSettings.darkMode"
                :rules="[(val: any) => !!val || 'Field is required']"
                :error="
                    !uploadStore.locationIdsUnique &&
                    currentLocationIndex === index
                "
                :error-message="
                    !uploadStore.locationIdsUnique &&
                    currentLocationIndex === index
                        ? 'Id is already in use.'
                        : 'Field is required'
                "
                @update:model-value="handleLocationIdInput(index)"
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
            <l-btn
                @click="uploadStore.removeLocation(index)"
                icon="delete"
                :dark="globalSettings.darkMode"
                class="self-stretch q-pl-sm q-pr-sm q-mr-none q-ml-sm"
                style="margin-bottom: 20px"
                type="previous"
                color="red"
            />
            <l-btn
                @click="openTagModal(index)"
                icon="mdi-tag"
                :dark="globalSettings.darkMode"
                class="self-stretch q-pl-sm q-pr-sm q-mr-none q-ml-none"
                style="margin-bottom: 20px"
                type="previous"
                color="blue"
            />
        </div>
    </div>
    <l-btn
        @click="uploadStore.addLocation"
        label="Add Location"
        class="q-mt-lg"
        type="action"
        icon-right="mdi-plus"
    />
    <q-dialog v-model="dialog" backdrop-filter="blur(4px)'">
        <q-card>
            <q-card-section class="row items-center q-pb-none text-h6">
                Add Or Remove Tags
            </q-card-section>
            <q-card-section class="row items-center q-pt-sm q-pb-none">
                Use the tags to allow for filtering on your data in the Loon UI.
            </q-card-section>

            <q-card-section>
                <template v-for="(item, idx) in tempTags" :key="idx">
                    <div class="row items-center q-mt-md">
                        <q-input
                            class="q-mr-md"
                            v-model="item[0]"
                            outlined
                            dense
                        ></q-input>
                        <div style="font-size: 18pt; margin-bottom: 5px">=</div>
                        <q-input
                            outlined
                            dense
                            class="q-ml-md"
                            v-model="item[1]"
                        ></q-input>
                        <l-btn
                            @click="removeTag(idx)"
                            icon="delete"
                            :dark="globalSettings.darkMode"
                            class="self-stretch"
                            type="previous"
                            color="red"
                        />
                    </div>
                </template>
                <l-btn
                    label="Add tag"
                    icon-right="mdi-plus"
                    @click="addTag()"
                    class="q-mt-lg"
                    type="action"
                />
            </q-card-section>
            <q-card-actions :align="'right'">
                <l-btn
                    type="cancel"
                    color="red"
                    @click="closeTagModal"
                    label="Cancel"
                />
                <l-btn type="confirm" @click="saveTags" label="Save" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<style scoped lang="scss">
.row.gap-10 {
    gap: 10px;
}
.row.gap-5 {
    gap: 5px;
}
</style>
