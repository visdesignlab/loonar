<script setup lang="ts">
import type { PropType } from 'vue';
import type {
    progress,
    FileToUpload,
} from '@/stores/componentStores/uploadStore';
export interface ProgressRecord {
    label: string;
    progress: progress;
    subProgress?: ProgressRecord[];
}

const props = defineProps({
    progressStatus: {
        type: Array as PropType<FileToUpload[]>,
        required: true,
    },
});

const getLabel = (file: FileToUpload): string => {
    // const type = file.uniqueId?.split("_")[-1]
    const splitUniqueId = file.uniqueId?.split('_');
    let fileType = '';
    let locationId = '';
    if (splitUniqueId) {
        fileType = splitUniqueId[2];
        locationId = splitUniqueId[1];
    }
    if (file.uploading !== 'succeeded' && file.uploading !== 'failed') {
        return `Uploading Location ${locationId} ${fileType}... `;
    } else if (
        file.processing !== 'succeeded' &&
        file.processing !== 'failed'
    ) {
        return `Processing Location ${locationId} ${fileType}... `;
    } else {
        return `Finished Location ${locationId} ${fileType}`;
    }
};

const getCurrProgressValue = (file: FileToUpload): number => {
    console.log(file.uniqueId);
    if (file.uploading == 'succeeded') {
        if (file.processing == 'running') {
            if (file.metadata && file.metadata.total && file.metadata.current) {
                const total = file.metadata.total;
                const current = file.metadata.current;
                const slope = 0.7 / total;
                if (current === total) {
                    console.log(1);
                    console.log(total, current);
                    return 1;
                }
                console.log(slope * current + 0.3);
                return slope * current + 0.3;
            } else {
                console.log(0.3);
                return 0.3;
            }
        } else if (file.processing === 'succeeded') {
            console.log(1);
            console.log('in succeeded');
            return 1;
        } else {
            console.log('processing not started');
            return 0.3;
        }
    }
    console.log('returning 0');
    return 0;
};
</script>

<template>
    <template v-for="(item, idx) in progressStatus" :key="item.label">
        <div class="row q-ma-sm q-mt-lg justify-between items-center">
            <div class="row items-center">
                <q-icon
                    v-if="
                        item.uploading === 'failed' ||
                        item.processing === 'failed'
                    "
                    class="q-mr-sm"
                    name="mdi-alert-box"
                    color="red"
                />
                <q-spinner
                    v-else-if="item.processing !== 'succeeded'"
                    class="q-mr-sm"
                />
                <q-icon
                    v-else
                    name="check_circle"
                    color="success"
                    class="q-mr-sm"
                />
                <div>{{ getLabel(item) }}</div>
            </div>

            <div
                v-if="item.metadata?.current && item.metadata?.total"
                class="row"
            >
                {{ `${item.metadata?.current}/${item.metadata?.total}` }}
            </div>
        </div>
        <div class="q-ma-sm q-mb-xl">
            <q-linear-progress
                size="5px"
                :value="getCurrProgressValue(item)"
                animation-speed="500"
                color="success"
            >
            </q-linear-progress>
        </div>
    </template>
</template>

<style scoped>
.spinner-container {
    display: flex;
    align-items: center;
}

.spinner-container span {
    margin-left: 10px;
    margin: 5px 0px 5px 10px;
}

.progress-not-started,
.progress-dispatched {
    font-weight: normal;
    color: grey;
}

.progress-running,
.progress-succeeded,
.progress-failed {
    font-weight: bold;
}

.progress-running {
    color: black;
}
.progress-succeeded {
    color: green;
}
.progress-failed {
    color: red;
}
</style>
