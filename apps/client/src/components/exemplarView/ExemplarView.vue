<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useElementSize } from '@vueuse/core';
import { Deck, OrthographicView, type PickingInfo } from '@deck.gl/core/typed';
import { ScatterplotLayer } from '@deck.gl/layers';

const deckGlContainer = ref(null);
const { width: deckGlWidth, height: deckGlHeight } =
    useElementSize(deckGlContainer);

let deckgl: any | null = null;
const initialViewState = {
    zoom: [0, 0],
    target: [0, 0],
    minZoom: -8,
    maxZoom: 8,
};

onMounted(() => {
    deckgl = new Deck({
        initialViewState,
        // @ts-ignore
        canvas: deckGlContainer.value?.id,
        views: new OrthographicView({
            id: 'exemplarController',
            controller: true,
        }),
        controller: true,
        layers: [],
        // debug: true,
        // onBeforeRender: (gl: any) => {
        //     console.count('before');
        //     console.log(gl);
        // },
        // onAfterRender: (gl: any) => {
        //     console.count('after');
        //     console.log(gl);
        // },
        // onError: (error: any, _layer: any) => {
        //     console.error('ERROR');
        //     console.log(error);
        // },
        // onWebGLInitialized: () => console.log('onWebGLInitialized'),
        // onViewStateChange: ({ viewState, oldViewState }) => {
        //     viewState.zoom[1] = 0;
        //     if (oldViewState && !isEqual(viewState.zoom, oldViewState.zoom)) {
        //         viewState.target[1] = oldViewState.target[1];
        //     }
        //     viewStateMirror.value = viewState as any;
        //     renderDeckGL();
        //     return viewState;
        // },
        // getTooltip: ({ object }) => {
        //     if (!object) return null;
        //     const trackId = object.trackId;
        //     if (trackId == null) return null;
        //     const time = dataPointSelectionUntrracked.hoveredTime;
        //     if (time == null) return null;
        //     const track = cellMetaData.trackMap?.get(trackId);
        //     if (!track) return null;
        //     const index = cellMetaData.getCellIndexWithTime(track, time);
        //     if (index === -1) return null;
        //     const cell = track.cells[index];
        //     if (!cell) return null;
        //     const formatter = format('.2f');
        //     let html = `<h5>Cell: ${trackId}</h5>`;
        //     html += `<div>Time: ${formatter(time)}</div>`;
        //     for (const {
        //         attrKey,
        //     } of looneageViewStore.horizonChartSettingList) {
        //         const val = formatter(cell.attrNum[attrKey]);
        //         html += `<div>${attrKey}: ${val}</div>`;
        //     }
        //     return {
        //         html,
        //     };
        // },
        // onClick(info, _event) {
        //     if (!info.object) {
        //         // canvas was clicked, but no cell object was picked
        //         dataPointSelection.selectedTrackId = null;
        //     }
        // },
        // onInteractionStateChange: () => console.log('onInteractionStateChange'),
        // onLoad: () => console.log('onLoad'),
    });
    renderDeckGL();
});

function renderDeckGL(): void {
    if (deckgl == null) return;

    const layers: any[] = [];
    // TODO: add layers to render

    layers.push(createTestScatterplotLayer());
    deckgl.setProps({
        layers,
        controller: true,
    });
}

const testOffset = 100;
function createTestScatterplotLayer() {
    return new ScatterplotLayer({
        id: 'test-scatter-plot',
        data: [
            [0, 0],
            [-testOffset, -testOffset],
            [testOffset, testOffset],
            [-testOffset, testOffset],
            [testOffset, -testOffset],
        ],
        radiusMinPixels: 0.25,
        getPosition: (d: [number, number]) => [d[0], d[1], 0],
        getFillColor: [33, 133, 234],
        getRadius: 25,
    });
}
</script>
<template>
    <canvas id="exemplar-deckgl-canvas" ref="deckGlContainer"></canvas>
</template>
<style scoped lang="scss"></style>
