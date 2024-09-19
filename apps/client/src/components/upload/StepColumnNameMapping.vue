<script setup lang="ts">
import { ref } from 'vue';
import { useUploadStore } from '@/stores/uploadStore';
import { useGlobalSettings } from '@/stores/globalSettings';
const uploadStore = useUploadStore();
const globalSettings = useGlobalSettings();

interface SpecialVariable {
    name: string;
    description: string;
}

const specialVariables = ref<SpecialVariable[]>([
    {
        name: 'frame',
        description:
            'The frame number indicates which number image the data row comes from in a sequence of images.',
    },
    {
        name: 'time',
        description:
            'The time when the image was recorded. Often this is relative to the start of the experiment. If this is not explicitly recorded, then the frame number can be used as a proxy.',
    },
    {
        name: 'id',
        description:
            "The unique ID for a particular tracked cell. This should be the same across frames for that cell's lifetime.",
    },
    {
        name: 'parent',
        description:
            'The id of the parent cell. If this is not tracked at all for an experiment, then map this column to the same one as the id column.',
    },
    {
        name: 'mass',
        description: 'The mass of the cell.',
    },
    {
        name: 'x',
        description:
            "The X coordinate for the cell's center position in pixel space. (It does not matter what definition of center is used.)",
    },
    {
        name: 'y',
        description: 'Same, but for the Y coordinate.',
    },
]);
</script>

<template>
    <template v-if="uploadStore.columnMappings">
        <div class="q-mb-lg">
            Since Loon expects certain variables to exist, those variables must
            be selected from the CSV file. The default values will guess which
            columns are correct based on the name, but should be checked and
            updated if incorrect.
        </div>

        <q-select
            v-for="variable in specialVariables"
            class="q-mb-md"
            :key="variable.name"
            outlined
            v-model="uploadStore.columnMappings[variable.name]"
            :options="uploadStore.columnNames"
            :label="variable.name"
            :hint="variable.description"
            :dark="globalSettings.darkMode"
        />
    </template>
    <template v-else>
        <div class="q-mb-lg">
            No column names were found in the uploaded CSV file.
        </div>
    </template>
</template>
<style scoped lang="scss"></style>
@/stores/data/uploadStore @/stores/componentStores/globalSettings
