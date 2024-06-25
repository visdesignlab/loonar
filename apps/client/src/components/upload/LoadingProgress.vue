<script lang="ts">
import type { PropType } from 'vue';
export interface ProgressRecord {
    label: string;
    progress: number;
    subProgress?: ProgressRecord[];
}

/*
* Progress Codes
*  0 - Not Started
*  1 - Dispatched (Uploading is never 'dispatched' in our design)
*  2 - Running
*  3 - Finished Successfully
* -1 - Failed
*/

export default {
    props: {
        progressStatus: {
            type: Array as PropType<ProgressRecord[]>,
            required: true,
        },
    },
};
</script>
<script setup lang="ts">
const determineProgress = (subProgress: ProgressRecord[]) => {
    const failed = subProgress.some((element) => element.progress === -1);
    if(failed){
        // If any failed, set total to failed
        return -1
    } else {
        const running = subProgress.some((element) => element.progress === 2 || element.progress === 1);
        if(running){
            // If none failed but any are running/queued, set to running
            return 2;
        } else {
            const succeeded = subProgress.every((element) => element.progress === 3);
            if (succeeded){
                // If none running, none failed, and all have succeeded, set to 3
                return 3;
            }
        }
    }
    // If none running, none failed, and not all succeeded, then it's still starting. Return 0
    return 0;
};
const getProgresses = (progressStatus: ProgressRecord[]) => {
    let tempProgressStatus: [ProgressRecord, number][] = progressStatus.map(
        (entry: ProgressRecord) => {
            if (entry.subProgress) {
                return [entry, determineProgress(entry.subProgress)];
            }
            return [entry, entry.progress];
        }
    );
    return tempProgressStatus;
};
</script>

<template>
    <div class="column">
        <template
            v-for="(item, idx) in getProgresses(progressStatus)"
            :key="item.label"
        >
            <div class="spinner-container">
                <q-spinner v-if="item[1] == 2" size="20" />
                <q-icon
                    v-if="item[1] == 3"
                    name="mdi-check-circle"
                    color="green"
                    size="20px"
                />
                <q-icon
                    v-if="item[1] == 0"
                    name="mdi-circle-outline"
                    size="20px"
                    color="grey"
                />
                <q-icon
                    v-if="item[1] === -1"
                    name="mdi-alert-circle-outline"
                    size="20px"
                    color="red"
                />
                <span
                    :class="{
                        'progress-2': item[1] === 2,
                        'progress-0': item[1] === 0,
                        'progress-3': item[1] === 3,
                    }"
                    style="font-size: 1.1em"
                    >{{ item[0].label }}</span
                >
            </div>
            <template v-for="subProgress in item[0].subProgress">
                <div class="spinner-container" style="margin-left: 50px">
                    <q-spinner-dots
                        v-if="subProgress.progress == 1"
                        size="20"
                    />
                    <q-spinner v-if="subProgress.progress == 2" size="20" />
                    <q-icon
                        v-if="subProgress.progress == 3"
                        name="mdi-check-circle"
                        color="green"
                        size="20px"
                    />
                    <q-icon
                        v-if="subProgress.progress == 0"
                        name="mdi-circle-outline"
                        size="20px"
                        color="grey"
                    />
                    <q-icon
                        v-if="subProgress.progress === -1"
                        name="mdi-alert-circle-outline"
                        size="20px"
                        color="red"
                    />
                    <span
                        :class="{
                            'progress-1': subProgress.progress === 1,
                            'progress-2': subProgress.progress === 2,
                            'progress-0': subProgress.progress === 0,
                            'progress-3': subProgress.progress === 3,
                            'progress-minus-1': subProgress.progress === -1,
                        }"
                        >{{ subProgress.label }}</span
                    >
                </div>
            </template>
        </template>
    </div>
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

.progress-0,
.progress-1 {
    font-weight: normal;
    color: grey;
}

.progress-2,
.progress-3,
.progress-minus-1 {
    font-weight:bold;
}

.progress-2 {
    color: black;
}
.progress-3 {
    color: green;
}
.progress-minus-1 {
    color:red;
}
</style>
