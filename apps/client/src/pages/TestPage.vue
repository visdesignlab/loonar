<script setup lang="ts">
import { computed, onMounted, ref, nextTick} from 'vue';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import TestFilterComponent from './TestFilterComponent.vue';
import TestFilterComponentTwo from './TestFilterComponentTwo.vue';
// import {useBrushStore} from '@/stores/dataStores/brushStore';
import LBtn from '@/components/custom/LBtn.vue';

import * as vg from '@uwdata/vgplot';
const datasetSelectionStore = useDatasetSelectionStore();
const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);

// const brushStore = useBrushStore();

const chartContainer = ref<HTMLElement | null>(null);

// let $slider = vg.Param.value(0);

let $brush = vg.Selection.intersect();
// brushStore.setBrush($brush);

$brush.addEventListener("value", (value:any) => {
    console.log(value);
})

const handleClick = () => {
    // console.log($brush.active.source)
    console.log($brush.clauses);
    $brush.active.source.publish([0,100])
    // $brush.update({source:'test', value:[50,200]})
    // $brush.update({source:$brush.active.source, value:[x1, x2], predicate: `"Frame" BETWEEN ${x1} AND ${x2}`})
    // // $brush.active.source.brush.clear();
    // let selectionRect = document.querySelector('rect.selection');
    // console.log(selectionRect);
    // selectionRect?.setAttribute('x', `${y1}`)
    // selectionRect?.setAttribute('width', `${y2}`)
    // let selectionRectHandleW = document.querySelector('rect.handle.handle--w');
    // selectionRectHandleW?.setAttribute('x', `${y2-4}`)
    // let selectionRectHandleE = document.querySelector('rect.handle.handle--e');
    // selectionRectHandleE?.setAttribute('x', `${width + y2-4}`)

    // $brush = vg.Selection.intersect();
    // console.log($brush)
    // $brush.value = [0, 500]
    // $brush.update({source: $brush.source, clause:`"Dry Mass (pg) BETWEEN 0 AND 100"`});
    // console.log($brush)
    // $brush.update({source:$brush.source, value:[0,100]})
    // console.log($brush);
}


function createChart(){
    if(chartContainer.value){
        const chartOne = vg.vconcat(vg.slider({
            select:"interval",
            as:$brush,
            from:`${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
            column:'Frame'
        }),vg.plot(
                // Plots Line Chart based on selection.
                vg.lineY(
                    vg.from(
                        `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`,
                    ),
                    {
                        x: "Frame",
                        y: vg.avg("Dry Mass (pg)"),
                        stroke: 'red',
                        strokeWidth: 1,
                        curve: 'basis',
                    }
                ),
                vg.intervalX({as: $brush, pixelSize:1 }),
                // General settings.
                vg.width(400),
                vg.height(400),

                // Gets rid of axes and margins!
                vg.axis(false),
                vg.margin(0)
            ));
        chartContainer.value.appendChild(chartOne);
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
    <div style="margin:100px; display:flex;flex-direction:row; padding:40px">
        <div style="display:flex;flex-direction: column;">
            Original Data
            <div ref="chartContainer">
            </div>
            <l-btn @click="handleClick" label="Test"></l-btn>
        </div>
        <div style="display:flex;flex-direction:column;">
            <TestFilterComponent :brush="$brush"/>
            <TestFilterComponentTwo />
        </div>

    </div>
</template>@/stores/dataStores/selectionStore