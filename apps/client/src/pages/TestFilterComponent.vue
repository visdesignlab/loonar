<script setup lang="ts">
import { computed, onMounted, ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { select } from 'd3-selection';

import * as vg from '@uwdata/vgplot';
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);
const selectionStore = useSelectionStore();
const { dataSelections} = storeToRefs(selectionStore)


const {brush} = defineProps<{
    brush?:any
}>()

const chartContainer = ref<HTMLElement | null>(null);

function createChart(){
    if(chartContainer.value){

            const chartTwo = vg.plot(
                // Plots Line Chart based on selection.
                vg.lineY(
                    vg.from(
                        `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                        {
                            filterBy: brush
                        }
                    ),
                    {
                        x: "Frame",
                        y: vg.avg("Dry Mass (pg)"),
                        stroke: 'blue',
                        strokeWidth: 1,
                        curve: 'basis',
                    }
                ),
                // General settings.
                vg.width(200),
                vg.height(200),

                // Gets rid of axes and margins!
                vg.axis(false),
                vg.margin(0)
            );
        chartContainer.value.appendChild(chartTwo);


    }

}

watch(experimentDataInitialized, async (isInitialized) => {    
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        createChart();
    }
}, {immediate : true, deep:true})


</script>
<template>
    <div style="margin:10px; border:1px solid black; height: 300px; width: 300px; padding:10px">
        Passing Brush through child component
        <div ref="chartContainer">

        </div>
    </div>
</template>