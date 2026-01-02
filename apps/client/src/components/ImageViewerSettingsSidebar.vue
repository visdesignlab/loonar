<script setup lang="ts">
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useImageViewerStore } from '@/stores/componentStores/imageViewerTrrackedStore';
import { useImageViewerStoreUntrracked } from '@/stores/componentStores/imageViewerUntrrackedStore';
import { useEventBusStore } from '@/stores/misc/eventBusStore';

import { storeToRefs } from 'pinia';
import { watch } from 'vue';
import { debounce } from 'lodash-es';

const imageViewerStore = useImageViewerStore();
const imageViewerStoreUntrracked = useImageViewerStoreUntrracked();
const globalSettings = useGlobalSettings();
const eventBusStore = useEventBusStore();
const { contrastLimitSlider, isPlaying, sizeT, sizeC } = storeToRefs(
    imageViewerStoreUntrracked
);
const { playbackSpeed } = storeToRefs(imageViewerStore);

let playbackInterval: number | null = null;

watch(isPlaying, (playing) => {
    if (playing) {
        if (playbackInterval) clearInterval(playbackInterval);
        playbackInterval = window.setInterval(() => {
            if (imageViewerStore.frameNumber >= sizeT.value) {
                imageViewerStore.frameNumber = 1;
            } else {
                imageViewerStore.stepForwards(sizeT.value);
            }
        }, 1000 / playbackSpeed.value);
    } else {
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
        }
    }
});

watch(playbackSpeed, (speed) => {
    if (isPlaying.value) {
        if (playbackInterval) clearInterval(playbackInterval);
        playbackInterval = window.setInterval(() => {
            if (imageViewerStore.frameNumber >= sizeT.value) {
                imageViewerStore.frameNumber = 1;
            } else {
                imageViewerStore.stepForwards(sizeT.value);
            }
        }, 1000 / speed);
    }
});

watch(
    contrastLimitSlider,
    debounce(() => {
        // only update store periodically so provStore is
        // not overwhelmed with new nodes
        imageViewerStore.contrastLimitSliderDebounced =
            contrastLimitSlider.value;
    }, 500)
);
watch(
    () => imageViewerStore.contrastLimitSliderDebounced,
    () => {
        // if the store changes (via a traversal in the prov tree)
        // update the slider
        contrastLimitSlider.value =
            imageViewerStore.contrastLimitSliderDebounced;
    }
);
</script>

<template>
    <div class="flex row no-wrap">
        <q-badge outline :color="globalSettings.normalizedBlack"
            >Frame:</q-badge
        >
        <span class="text-caption q-ml-sm"
            >{{ imageViewerStore.frameNumber }} / {{ sizeT }}</span
        >
    </div>
    <div class="flex row no-wrap q-mt-sm q-mb-sm">
        <q-btn-group outline rounded class="q-mr-md">
            <q-btn
                @click="imageViewerStore.stepBackwards"
                size="sm"
                outline
                round
                title="previous frame"
                icon="arrow_left"
            />
            <q-btn
                @click="isPlaying = !isPlaying"
                size="sm"
                outline
                round
                :title="isPlaying ? 'pause' : 'play'"
                :icon="isPlaying ? 'pause' : 'play_arrow'"
            >
                <q-menu anchor="bottom middle" self="top middle">
                    <div
                        class="row no-wrap items-center q-pa-md"
                        style="min-width: 200px"
                    >
                        <span class="q-mr-sm text-caption">Speed (fps):</span>
                        <q-slider
                            v-model="playbackSpeed"
                            :min="1"
                            :max="60"
                            label
                            dense
                            class="col"
                        />
                        <span class="q-ml-sm text-caption">{{
                            playbackSpeed
                        }}</span>
                    </div>
                </q-menu>
            </q-btn>
            <q-btn
                @click="() => imageViewerStore.stepForwards(sizeT - 1)"
                size="sm"
                outline
                round
                title="next frame"
                icon="arrow_right"
            />
        </q-btn-group>
        <q-slider
            class="force-repeat"
            v-model="imageViewerStore.frameNumber"
            :min="1"
            :max="sizeT"
            label
            :dark="globalSettings.darkMode"
        />
    </div>
    <template v-if="sizeC > 1">
        <div class="flex row no-wrap">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Channel:</q-badge
            >
            <span class="text-caption q-ml-sm"
                >{{ imageViewerStore.selectedChannel }} / {{ sizeC - 1 }}</span
            >
        </div>
        <div class="flex row no-wrap q-mt-sm q-mb-sm">
            <q-btn-group outline rounded class="q-mr-md">
                <q-btn
                    @click="imageViewerStore.stepChannelBackwards"
                    size="sm"
                    outline
                    round
                    title="previous frame"
                    icon="arrow_left"
                />
                <q-btn
                    @click="
                        () => imageViewerStore.stepChannelForwards(sizeC - 1)
                    "
                    size="sm"
                    outline
                    round
                    title="next frame"
                    icon="arrow_right"
                />
            </q-btn-group>
            <q-slider
                class="force-repeat"
                v-model="imageViewerStore.selectedChannel"
                :min="0"
                :max="sizeC - 1"
                label
                :dark="globalSettings.darkMode"
            />
        </div>
    </template>
    <q-btn
        @click="eventBusStore.emitter.emit('resetImageView')"
        icon="center_focus_strong"
        outline
        >Reset View</q-btn
    >
    <q-separator class="q-mt-md q-mb-md" />
    <!-- <q-badge outline :color="globalSettings.normalizedBlack">Layers:</q-badge> -->
    <div class="flex column">
        <q-toggle v-model="imageViewerStore.showImageLayer" label="Image" />
        <q-card-section v-if="imageViewerStore.showImageLayer">
            <q-badge
                outline
                :color="globalSettings.normalizedBlack"
                class="q-mb-sm"
                >Colormap:</q-badge
            >
            <q-select
                v-model="imageViewerStore.colormap"
                :options="imageViewerStore.colormapOptions"
                :dark="globalSettings.darkMode"
                outlined
                dense
                class="mb-3"
            ></q-select>
            <!-- </div> -->

            <q-badge outline :color="globalSettings.normalizedBlack"
                >Dynamic Range:</q-badge
            >
            <q-range
                v-model="contrastLimitSlider"
                :min="imageViewerStore.contrastLimitExtentSlider.min"
                :max="imageViewerStore.contrastLimitExtentSlider.max"
                :step="1"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
        <q-toggle
            v-model="imageViewerStore.showCellBoundaryLayer"
            label="Cell Boundary"
        />
        <q-toggle v-model="imageViewerStore.showTrailLayer" label="Trail" />
        <q-card-section v-if="imageViewerStore.showTrailLayer">
            <q-badge outline :color="globalSettings.normalizedBlack"
                >Trail Length:</q-badge
            >
            <q-slider
                v-model="imageViewerStore.trailLength"
                :min="0"
                :max="sizeT"
                label
                :dark="globalSettings.darkMode"
            />
        </q-card-section>
        <q-toggle v-model="imageViewerStore.showLineageLayer" label="Lineage" />
    </div>
</template>

<style scoped lang="scss"></style>
