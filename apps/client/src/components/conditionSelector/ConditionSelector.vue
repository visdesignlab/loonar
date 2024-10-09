<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
const globalSettings = useGlobalSettings();

const yTag = "Drug";
const xTag = "Concentration";
const yLabels = ["Tylenol", "Tylenol", "Tylenol"];
const xLabels = ["0.1", "0.2", "0.2", "0.4"];


</script>

<template>
    <div class="flex items-center h-100">
        <div
            bordered
            :dark="globalSettings.darkMode"
            class="inner-card condition-selector-container"
        >
            <div class="q-pa-sm items-center justify-center flex y-tag"><div>{{yTag}}</div></div>
            <div class="q-pa-sm items-center justify-center flex condition-charts-container">
                    <div class="q-pa-sm items-center justify-center flex y-labels">
                        <template v-for="(labelY) in yLabels">
                            <div>{{ labelY }}</div>
                        </template>
                    </div>
                    <div class="q-pa-sm items-center justify-center column chart-area">
                        <template v-for="(ely, idy) in yLabels">
                            <div class="chart-row row justify-space-between align-center">
                                <template v-for="(elx,idx) in xLabels">
                                    <div class="chart"></div>
                                </template>
                            </div>
                        </template>
                    </div>
                    <div class="q-pa-sm items-center justify-center flex">All</div>
                    <div class="q-pa-sm items-center justify-around row flex">
                        <template v-for="(labelX) in xLabels">
                            <div class="row justify-center align-center flex x-label"><div>{{ labelX }}</div></div>
                        </template>
                    </div>

            </div>
            <div class="q-pa-sm items-center justify-center flex">Legend</div>
            <div class="q-pa-sm items-center justify-center flex">{{ xTag }}</div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.chart-area{
    gap:10px;
    .chart-row{
        flex:1;
        width:100%;
        .chart{
            width:100px;
            height:100px;
            margin:10px;
            border:1px solid black;
            box-sizing:border-box;
        }
    }
}


.condition-selector-container{
    box-sizing:border-box;
    grid-template-columns:80px 1fr;
    grid-template-rows: 1fr 80px;
    font-size:0.8rem;
    gap: 10px;
    display:grid;
    width:100%;
    height:100%;
    box-sizing:border-box;
    & > div:not(.condition-charts-container){
        border:1px solid black;
        box-sizing:border-box;
        width:100%;
        height:100%;

    }
    .y-tag div{
        transform:rotate(-90deg);
    }

    .condition-charts-container{
        grid-template-columns: 80px 1fr;
        grid-template-rows: 1fr 80px;
        gap: 10px;
        display:grid;
        width:100%;
        height:100%;
        &> div{
            width:100%;
            height:100%;
            border:1px solid black;
        }
        .y-labels div{
            transform:rotate(-90deg);
        }
    }
}

.inner-card {
    border-radius: 30px;
}
</style>
