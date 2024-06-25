<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUploadStore } from '@/stores/uploadStore';
const uploadStore = useUploadStore();

// import { defineProps, defineEmits } from 'vue';

// const props = defineProps<{
//     experimentName: string;
//     numberOfLocations: number;
// }>();

// const emits = defineEmits<{
//     (event: 'update:experimentName', value: string): void;
//     (event: 'update:numberOfLocations', value: string): void;
// }>();

// const updateExperimentNameValue = (value: string | number | null) => {
//     console.log('update Exp value is called');
//     emits('update:experimentName', value?.toString() ?? '');
// };

// const updateNumberOfLocationsValue = (value: string | number | null) => {
//     console.log('update location value is called');
//     emits('update:numberOfLocations', value?.toString() ?? '');
// };
</script>

<template>
    <!-- <span class="step-title"> Create Your Experiment </span> -->
    <div class="column q-mt-sm q-gutter-lg">
        <q-input
            v-model="uploadStore.experimentName"
            outlined
            style="width: 500px"
            label-slot
            :rules="[(val) => !!val || 'Field is required']"
            label="Experiment Name"
        >
        </q-input>
        <!-- <q-input
            :model-value="numberOfLocations"
            @update:model-value="updateNumberOfLocationsValue"
            outlined
            style="width: 500px"
            label-slot
            :rules="[
                (val) => !!val || 'Field is required',
                (val) =>
                    !isNaN(parseInt(val)) || 'Please enter in a valid number.',
            ]"
            hint="Number of imaging locations that will be added."
            label="Number of Locations"
        > -->
        <!-- </q-input> -->
    </div>
</template>

<style scoped lang="scss"></style>
