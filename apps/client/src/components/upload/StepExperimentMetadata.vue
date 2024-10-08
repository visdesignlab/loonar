<script setup lang="ts">
import { computed } from 'vue';
import { useUploadStore } from '@/stores/componentStores/uploadStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const uploadStore = useUploadStore();
const globalSettings = useGlobalSettings();

function onInput() {
    uploadStore.experimentNameValid = true;
}
</script>

<template>
    <div>Select experiment metadata. The experiment name must be unique.</div>
    <q-input
        class="q-mt-md"
        v-model="uploadStore.experimentName"
        outlined
        style="width: 500px"
        label-slot
        :rules="[(val) => !!val || 'Field is required']"
        label="Experiment Name"
        :dark="globalSettings.darkMode"
        :error="!uploadStore.experimentNameValid"
        :error-message="
            !uploadStore.experimentNameValid
                ? 'Name is already in use.'
                : 'Field is required'
        "
        @update:model-value="onInput"
    >
    </q-input>
</template>

<style scoped lang="scss"></style>
