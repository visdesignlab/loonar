<script setup lang="ts">
import {ref, watch, nextTick} from 'vue';
import * as vg from '@uwdata/vgplot';
// import { ref, nextTick} from 'vue';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { storeToRefs } from 'pinia';
import LBtn from '../custom/LBtn.vue';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';



// // Will use soon for dark mode.
// const globalSettings = useGlobalSettings();

const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);
const { chartColorScheme } = useConditionSelectorStore();
const selectionStore = useSelectionStore();

const mosaicSelectionStore = useMosaicSelectionStore();

const { dataSelections } = storeToRefs(selectionStore);



const chartContainer = ref<HTMLElement | null>(null);
watch(experimentDataInitialized, async (isInitialized) => {    
    if(isInitialized){
        await nextTick(); // Helps with hot reloading. On save, html ref will be temporarily none. This will wait until html has a ref.
        createChart();
    }
}, {immediate : true, deep:true})


const handleOnClick = () => {
    // console.log('hello')
    // const plotName = "avg_mass"
    // const range = [0,100];
    // selectionStore.updateSelection(plotName, [0,500], "track");
    
    // console.log(dataSelections.value);
}


async function createChart(){

    // await vg.coordinator().exec([`
    //     CREATE TEMP TABLE IF NOT EXISTS my_testing_table_density_two AS
    //     SELECT AVG("Dry Mass (pg)") as avg_mass, "Tracking ID" as tracking_id
    //     FROM ${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata
    //     GROUP BY "Tracking ID"
    // `]);



    // if(chartContainer.value){
    //     const chart = vg.plot(
    //     vg.densityY(
    //         vg.from(
    //             `my_testing_table_density`),
    //             {
    //                 x: "avg_mass",
    //                 fill: 'grey',
    //                 fillOpacity:0.2,
    //                 curve: 'basis',
    //                 stroke:'black'
    //             }
    //     ),
    //     vg.width(300),
    //     vg.height(300)
    // )
    // chartContainer.value.appendChild(chart);
    // }

    // For univariate cell plot if we want to switch to density plot

            // vg.densityY(
            //     vg.from(
            //         datasetName
            //     ),{
            //         x:`${column}`,
            //         fill:'#cccccc',
            //         curve: 'basis',
            //         stroke:'black'
            //     }
            // ),
            // vg.densityY(
            //     vg.from(
            //         datasetName, {filterBy: mosaicSelection}
            //     ),{
            //         x:`${column}`,
            //         fill: '#377eb8',
            //         curve: 'basis',
            //         stroke:'black'
            //     }
            // ),


}


</script>
<template>
    <!-- <div style="width:100%;height:100%;" ref="chartContainer"></div> -->
    <l-btn @click="handleOnClick" style="margin-left:20px" label="Click me!">Test</l-btn>
    <div></div>
</template>
<style scoped lang="scss">
</style>