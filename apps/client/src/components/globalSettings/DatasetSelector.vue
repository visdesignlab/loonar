<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';

import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

import {
    buildExperimentTree,
    type TreeNode,
    type FolderNode,
    type ExperimentNode,
} from '@/util/experimentTree';

const globalSettings = useGlobalSettings();
const datasetSelectionStore = useDatasetSelectionStore();
const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
const $q = useQuasar();

const selectionStore = useSelectionStore();
const mosaicSelectionStore = useMosaicSelectionStore();
const conditionSelectorStore = useConditionSelectorStore();

const menuRef = ref<any>(null);

watch(
    () => datasetSelectionStore.fetchingTabularData,
    () => {
        if (datasetSelectionStore.fetchingTabularData) {
            $q.loading.show({
                delay: 0,
            });
        } else {
            $q.loading.hide();
        }
    }
);

function onClickLocation(location: any) {
    datasetSelectionStore.selectImagingLocation(location);
}

const shortExpName = computed<string>(() => {
    if (datasetSelectionStore.currentExperimentMetadata?.name) {
        return datasetSelectionStore.currentExperimentMetadata.name;
    }
    let shortName = datasetSelectionTrrackedStore.currentExperimentFilename;
    if (shortName === null) return 'Select Experiment';
    // Extract just the filename from path
    const parts = shortName.split('/');
    shortName = parts[parts.length - 1].split('.')[0];
    const maxChar = 24;
    if (shortName.length > maxChar) {
        shortName = shortName.slice(0, maxChar) + '...';
    }
    return shortName;
});

const treeOptions = computed<TreeNode[]>(() => {
    const list = datasetSelectionStore.experimentFilenameList;
    if (!list || list.length === 0) return [];
    return buildExperimentTree(list);
});

function selectExperiment(path: string) {
    datasetSelectionTrrackedStore.currentExperimentFilename = path;
    onSelectExperiment();
    menuRef.value?.hide();
}

function onSelectExperiment() {
    selectionStore.resetState();
    mosaicSelectionStore.resetState();
    conditionSelectorStore.resetState();
}
</script>

<template>
    <div class="dataset-selector-dropdown">
        <q-btn
            flat
            no-caps
            class="experiment-btn full-width"
            :class="{ 'dark-mode': globalSettings.darkMode }"
        >
            <div class="experiment-btn-content">
                <div class="experiment-btn-label">
                    <span class="label-caption">Experiment</span>
                    <span class="label-value">{{ shortExpName }}</span>
                </div>
                <q-icon name="arrow_drop_down" size="sm" />
            </div>

            <q-menu
                ref="menuRef"
                :dark="globalSettings.darkMode"
                class="experiment-menu"
                anchor="bottom left"
                self="top left"
                fit
            >
                <q-list
                    :dark="globalSettings.darkMode"
                    class="experiment-tree-list"
                >
                    <template
                        v-for="node in treeOptions"
                        :key="
                            node.type === 'experiment'
                                ? (node as ExperimentNode).path
                                : (node as FolderNode).label
                        "
                    >
                        <!-- Folder node -->
                        <q-expansion-item
                            v-if="node.type === 'folder'"
                            :label="(node as FolderNode).label"
                            icon="folder"
                            :dark="globalSettings.darkMode"
                            dense
                            dense-toggle
                            header-class="folder-header"
                        >
                            <!-- Recursive children via nested component -->
                            <template
                                v-for="child in (node as FolderNode).children"
                                :key="
                                    child.type === 'experiment'
                                        ? (child as ExperimentNode).path
                                        : (child as FolderNode).label
                                "
                            >
                                <q-expansion-item
                                    v-if="child.type === 'folder'"
                                    :label="(child as FolderNode).label"
                                    icon="folder"
                                    :dark="globalSettings.darkMode"
                                    dense
                                    dense-toggle
                                    header-class="folder-header nested-folder"
                                >
                                    <template
                                        v-for="grandchild in (
                                            child as FolderNode
                                        ).children"
                                        :key="
                                            grandchild.type === 'experiment'
                                                ? (
                                                      grandchild as ExperimentNode
                                                  ).path
                                                : (grandchild as FolderNode)
                                                      .label
                                        "
                                    >
                                        <q-expansion-item
                                            v-if="
                                                grandchild.type === 'folder'
                                            "
                                            :label="
                                                (grandchild as FolderNode).label
                                            "
                                            icon="folder"
                                            :dark="globalSettings.darkMode"
                                            dense
                                            dense-toggle
                                            header-class="folder-header nested-folder-deep"
                                        >
                                            <q-item
                                                v-for="ggchild in (
                                                    grandchild as FolderNode
                                                ).children"
                                                :key="
                                                    ggchild.type ===
                                                    'experiment'
                                                        ? (
                                                              ggchild as ExperimentNode
                                                          ).path
                                                        : (
                                                              ggchild as FolderNode
                                                          ).label
                                                "
                                                clickable
                                                @click="
                                                    selectExperiment(
                                                        (
                                                            ggchild as ExperimentNode
                                                        ).path
                                                    )
                                                "
                                                :active="
                                                    datasetSelectionTrrackedStore.currentExperimentFilename ===
                                                    (ggchild as ExperimentNode)
                                                        .path
                                                "
                                                active-class="bg-primary text-white"
                                                :dark="globalSettings.darkMode"
                                                class="experiment-item nested-experiment-deep"
                                            >
                                                <q-item-section avatar>
                                                    <q-icon
                                                        name="science"
                                                        size="xs"
                                                    />
                                                </q-item-section>
                                                <q-item-section>{{
                                                    ggchild.label
                                                }}</q-item-section>
                                            </q-item>
                                        </q-expansion-item>

                                        <q-item
                                            v-else
                                            clickable
                                            @click="
                                                selectExperiment(
                                                    (
                                                        grandchild as ExperimentNode
                                                    ).path
                                                )
                                            "
                                            :active="
                                                datasetSelectionTrrackedStore.currentExperimentFilename ===
                                                (grandchild as ExperimentNode)
                                                    .path
                                            "
                                            active-class="bg-primary text-white"
                                            :dark="globalSettings.darkMode"
                                            class="experiment-item nested-experiment"
                                        >
                                            <q-item-section avatar>
                                                <q-icon
                                                    name="science"
                                                    size="xs"
                                                />
                                            </q-item-section>
                                            <q-item-section>{{
                                                grandchild.label
                                            }}</q-item-section>
                                        </q-item>
                                    </template>
                                </q-expansion-item>

                                <q-item
                                    v-else
                                    clickable
                                    @click="
                                        selectExperiment(
                                            (child as ExperimentNode).path
                                        )
                                    "
                                    :active="
                                        datasetSelectionTrrackedStore.currentExperimentFilename ===
                                        (child as ExperimentNode).path
                                    "
                                    active-class="bg-primary text-white"
                                    :dark="globalSettings.darkMode"
                                    class="experiment-item nested-experiment"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="science" size="xs" />
                                    </q-item-section>
                                    <q-item-section>{{
                                        child.label
                                    }}</q-item-section>
                                </q-item>
                            </template>
                        </q-expansion-item>

                        <!-- Experiment leaf node at root level -->
                        <q-item
                            v-else
                            clickable
                            @click="
                                selectExperiment(
                                    (node as ExperimentNode).path
                                )
                            "
                            :active="
                                datasetSelectionTrrackedStore.currentExperimentFilename ===
                                (node as ExperimentNode).path
                            "
                            active-class="bg-primary text-white"
                            :dark="globalSettings.darkMode"
                            class="experiment-item"
                        >
                            <q-item-section avatar>
                                <q-icon name="science" size="xs" />
                            </q-item-section>
                            <q-item-section>{{ node.label }}</q-item-section>
                        </q-item>
                    </template>
                </q-list>
            </q-menu>
        </q-btn>

        <q-btn
            flat
            dense
            icon="refresh"
            @click="datasetSelectionStore.refreshFileNameList"
            style="box-sizing: border-box"
            :dark="globalSettings.darkMode"
        />
    </div>

    <div
        v-if="
            datasetSelectionStore.currentExperimentMetadata &&
            datasetSelectionStore.currentExperimentMetadata.locationMetadataList
                .length > 0
        "
        class="mt-3"
    >
        <span>Imaging Locations</span>
        <q-list bordered separator :dark="globalSettings.darkMode">
            <q-item
                v-for="location in datasetSelectionStore
                    .currentExperimentMetadata?.locationMetadataList"
                :key="location.id"
                clickable
                v-ripple
                :active="
                    datasetSelectionStore.shownSelectedLocationIds[location.id]
                "
                active-class="bg-primary text-white"
                @click="
                    () => {
                        onClickLocation(location);
                    }
                "
                :dark="globalSettings.darkMode"
                ><q-item-section>{{
                    location.name ?? location.id
                }}</q-item-section></q-item
            >
        </q-list>
    </div>
</template>

<style scoped>
.dataset-selector-dropdown {
    display: flex;
    align-items: center;
    gap: 4px;
}

.experiment-btn {
    flex: 1;
    text-align: left;
    border: 1px solid rgba(0, 0, 0, 0.24);
    border-radius: 4px;
    padding: 4px 8px;
    min-height: 40px;
}

.experiment-btn.dark-mode {
    border-color: rgba(255, 255, 255, 0.28);
}

.experiment-btn-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.experiment-btn-label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.label-caption {
    font-size: 0.7rem;
    opacity: 0.6;
    line-height: 1;
}

.label-value {
    font-size: 0.875rem;
    line-height: 1.4;
}

.experiment-menu {
    max-height: 400px;
    min-width: 260px;
}

.experiment-tree-list {
    padding: 0;
}

.experiment-item {
    min-height: 32px;
    padding-top: 2px;
    padding-bottom: 2px;
}

:deep(.folder-header) {
    min-height: 32px;
    padding-top: 2px;
    padding-bottom: 2px;
    font-weight: 500;
}

/* Remove default padding since we use our own whitespace indent */
:deep(.q-item) {
    padding-left: 8px;
}

/* ── Tree-line indentation ── */

/* Level 1: children of a top-level folder */
:deep(.q-expansion-item > .q-expansion-item__container > .q-expansion-item__content > .q-list > .q-item),
:deep(.q-expansion-item > .q-expansion-item__container > .q-expansion-item__content > .q-list > .q-expansion-item > .q-expansion-item__container > .q-item__section--side) {
    /* handled individually below */
}

/* Generic indentation connector: vertical line from parent through children */
:deep(.q-expansion-item .q-expansion-item__content) {
    position: relative;
    padding-left: 16px;
}

/* Vertical tree line running alongside children */
:deep(.q-expansion-item .q-expansion-item__content::before) {
    content: '';
    position: absolute;
    left: 17px;
    top: 0;
    bottom: 0;
    width: 1px;
    background-color: rgba(128, 128, 128, 0.35);
}

/* Branch connector for each child item (├── style) */
:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-item),
:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-expansion-item) {
    position: relative;
}

:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-item::before),
:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-expansion-item::before) {
    content: '';
    position: absolute;
    left: -15px;
    top: 50%;
    width: 14px;
    height: 1px;
    background-color: rgba(128, 128, 128, 0.35);
}

/* Last child gets └── style: cut the vertical line at the branch point */
:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-item:last-child::after),
:deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-expansion-item:last-child::after) {
    content: '';
    position: absolute;
    left: -16px;
    top: 50%;
    bottom: 0;
    width: 2px;
    background-color: var(--tree-line-bg, white);
}

/* Cover the vertical line below the last child */
:deep(.q-expansion-item .q-expansion-item__content > .q-list > :last-child) {
    /* nothing extra needed, the ::after above covers it */
}

/* Dark mode tree line color adjustment */
.dark-mode :deep(.q-expansion-item .q-expansion-item__content::before),
.dark-mode :deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-item::before),
.dark-mode :deep(.q-expansion-item .q-expansion-item__content > .q-list > .q-expansion-item::before) {
    background-color: rgba(200, 200, 200, 0.3);
}
</style>
