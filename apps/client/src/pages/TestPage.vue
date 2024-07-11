<!-- <script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';

import { router } from '@/router';
import * as vg from '@uwdata/vgplot';

// Function to determine if the create experiment button should be enabled.
const charts = ref<null | HTMLElement>(null);
const vgPlotContainer = ref<HTMLDivElement | null>(null);
const dataInitialized = ref<boolean>(true);
async function createCharts() {
    // Configure the coordinator to use DuckDB-WASM
    await vg.coordinator().exec([
        vg.loadObjects('md', [
            { i: 0, u: 'A', v: 2 },
            { i: 1, u: 'B', v: 8 },
            { i: 2, u: 'C', v: 3 },
            { i: 3, u: 'D', v: 7 },
            { i: 4, u: 'E', v: 5 },
            { i: 5, u: 'F', v: 4 },
            { i: 6, u: 'G', v: 6 },
            { i: 7, u: 'H', v: 1 },
        ]),
    ]);
    charts.value = makePlot();
    if (vgPlotContainer.value) {
        vgPlotContainer.value.appendChild(charts.value!);
    }
}
const defaultAttributes = [
    vg.xAxis(null),
    vg.yAxis(null),
    vg.margins({ left: 5, top: 5, right: 5, bottom: 5 }),
    vg.width(160),
    vg.height(100),
    vg.yDomain([0, 9]),
];
function makePlot() {
    const plot = vg.vconcat(
        vg.hconcat(
            vg.plot(
                vg.barY(vg.from('md'), { x: 'u', y: 'v', fill: 'steelblue' }),
                ...defaultAttributes
            ),
            vg.plot(
                vg.lineY(vg.from('md'), {
                    x: 'u',
                    y: 'v',
                    stroke: 'steelblue',
                    curve: 'monotone-x',
                    marker: 'circle',
                }),
                ...defaultAttributes
            ),
            vg.plot(
                vg.text(vg.from('md'), {
                    x: 'u',
                    y: 'v',
                    text: 'u',
                    fill: 'steelblue',
                }),
                ...defaultAttributes
            ),
            vg.plot(
                vg.tickY(vg.from('md'), {
                    x: 'u',
                    y: 'v',
                    stroke: 'steelblue',
                }),
                ...defaultAttributes
            ),
            vg.plot(
                vg.areaY(vg.from('md'), { x: 'u', y: 'v', fill: 'steelblue' }),
                ...defaultAttributes
            )
        ),
        vg.hconcat(
            vg.plot(
                vg.dot(vg.from('md'), {
                    x: 'i',
                    y: 'v',
                    fill: 'currentColor',
                    r: 1.5,
                }),
                vg.regressionY(vg.from('md'), {
                    x: 'i',
                    y: 'v',
                    stroke: 'steelblue',
                }),
                ...defaultAttributes,
                vg.xDomain([-0.5, 7.5])
            ),
            vg.plot(
                vg.hexgrid({ stroke: '#aaa', strokeOpacity: 0.5 }),
                vg.hexbin(vg.from('md'), { x: 'i', y: 'v', fill: vg.count() }),
                ...defaultAttributes,
                vg.colorScheme('blues'),
                vg.xDomain([-1, 8])
            ),
            vg.plot(
                vg.contour(vg.from('md'), {
                    x: 'i',
                    y: 'v',
                    stroke: 'steelblue',
                    bandwidth: 15,
                }),
                ...defaultAttributes,
                vg.xDomain([-1, 8])
            ),
            vg.plot(
                vg.heatmap(vg.from('md'), {
                    x: 'i',
                    y: 'v',
                    fill: 'density',
                    bandwidth: 15,
                }),
                ...defaultAttributes,
                vg.colorScheme('blues'),
                vg.xDomain([-1, 8])
            ),
            vg.plot(
                vg.denseLine(vg.from('md'), {
                    x: 'i',
                    y: 'v',
                    fill: 'density',
                    bandwidth: 2,
                    pixelSize: 1,
                }),
                ...defaultAttributes,
                vg.colorScheme('blues'),
                vg.xDomain([-1, 8])
            )
        )
    );
    return plot;
}
createCharts();
</script>
<template>
    <div
        id="plotContainer"
        ref="vgPlotContainer"
        style="position: relative"
    ></div>
</template>

<style scoped></style> -->

<template>
    <div v-if="cellMetaData.dataInitialized">
        <q-item-section style="position: relative">
            <div
                id="plotContainer"
                ref="vgPlotContainer"
                style="position: relative"
            ></div>
        </q-item-section>
    </div>
    <div v-else>"HELLOOOO"</div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import * as vg from '@uwdata/vgplot';
import { useCellMetaData } from '@/stores/cellMetaData';
import { useDatasetSelectionStore } from '@/stores/datasetSelectionStore';
import { storeToRefs } from 'pinia';
const vgPlotContainer = ref<HTMLDivElement | null>(null);
const cellMetaData = useCellMetaData();
const datasetSelectionStore = useDatasetSelectionStore();
const { dataInitialized } = storeToRefs(cellMetaData);
const charts = ref<null | HTMLElement>(null);
async function createCharts() {
    console.log('created charts');
    // Configure the coordinator to use DuckDB-WASM
    // vg.coordinator().databaseConnector(vg.wasmConnector());
    if (!datasetSelectionStore.currentLocationMetadata) {
        return;
    }
    const url = datasetSelectionStore.getServerUrl(
        datasetSelectionStore.currentLocationMetadata.tabularDataFilename
    );
    console.log('about to load csv');
    console.log(url);
    let new_url = url.replace('localhost/data', 'minio:9000/data');
    await vg
        .coordinator()
        .exec([
            vg.loadCSV(
                'data',
                'http://minio:9000/data/TheRealFinalExample/location_0/cells.csv'
            ),
        ]);
    console.log('did we reach here');
    charts.value = makePlot('mass');
    if (vgPlotContainer.value) {
        vgPlotContainer.value.appendChild(charts.value!);
    }
}
watch(dataInitialized, createCharts);
// createCharts();
function makePlot(column: string) {
    const plot = vg.plot(
        vg.rectY(vg.from('data'), {
            x: vg.bin(column),
            y: vg.count(),
            fill: '#cccccc',
            inset: 1,
        }),
        vg.marginBottom(130),
        vg.marginTop(30),
        vg.width(600),
        vg.height(250),
        vg.style({ 'font-size': '30px' }),
        vg.xDomain(vg.Fixed),
        vg.xLabelAnchor('center'),
        vg.xTickPadding(10),
        vg.xLabelOffset(80),
        vg.xAxis('bottom'),
        vg.xLine(true),
        vg.xAlign(0),
        vg.xInsetRight(20),
        vg.xTickSpacing(100),
        vg.yLabelAnchor('top'),
        vg.yAxis(null),
        vg.yTicks(0)
    );
    return plot;
}
</script>
<style scoped>
.plot-container {
    display: flex;
    align-items: center;
    text-align: center;
}
</style>
