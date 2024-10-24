<script setup lang="ts">
import { computed, onMounted, ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useFilterStore } from '@/stores/componentStores/filterStore';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { select } from 'd3-selection';
// import { useBrushStore } from '@/stores/dataStores/brushStore';

import * as vg from '@uwdata/vgplot';
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);
const filterStore = useFilterStore();
const { filters } = storeToRefs(filterStore);
const selectionStore = useSelectionStore();
const { dataSelections} = storeToRefs(selectionStore)

// const brushStore = useBrushStore();

// brushStore.brush.addEventListener('value',(value:any) => {
//     // console.log(brushStore.brush);
// })

const chartContainer = ref<HTMLElement | null>(null);

// function createChart(){
//     if(chartContainer.value){

//             const chartTwo = vg.plot(
//                 // Plots Line Chart based on selection.
//                 vg.lineY(
//                     vg.from(
//                         `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
//                         {
//                             filterBy: brushStore.brush
//                         }
//                     ),
//                     {
//                         x: "Frame",
//                         y: vg.avg("Dry Mass (pg)"),
//                         stroke: 'blue',
//                         strokeWidth: 1,
//                         curve: 'basis',
//                     }
//                 ),
//                 // General settings.
//                 vg.width(200),
//                 vg.height(200),

//                 // Gets rid of axes and margins!
//                 vg.axis(false),
//                 vg.margin(0)
//             );
//         chartContainer.value.appendChild(chartTwo);


//     }

// }

watch(experimentDataInitialized, async (isInitialized) => {    
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        // createChart();
    }
}, {immediate : true, deep:true})


</script>
<template>
    <div style="margin:10px; border:1px solid black; height: 300px; width: 300px; padding:10px">
        Passing Brush through Store
        <div ref="chartContainer">

        </div>
    </div>
</template>@/stores/dataStores/selectionStore