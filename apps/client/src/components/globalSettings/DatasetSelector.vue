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

const treeOptions = computed<TreeNode[]>(() => {
    const list = datasetSelectionStore.experimentFilenameList;
    if (!list || list.length === 0) return [];
    return buildExperimentTree(list);
});

function selectExperiment(path: string) {
    datasetSelectionTrrackedStore.currentExperimentFilename = path;
    onSelectExperiment();
}

function onSelectExperiment() {
    selectionStore.resetState();
    mosaicSelectionStore.resetState();
    conditionSelectorStore.resetState();
}

const filter = ref('');
const selectedNodeKey = ref<string | null>(null);

const mappedTreeNodes = computed(() => {
    const mapNode = (node: TreeNode, parentPath = ''): any => {
        const currentKey =
            node.type === 'experiment'
                ? (node as ExperimentNode).path
                : `${parentPath}/${(node as FolderNode).label}`;
        if (node.type === 'folder') {
            return {
                label: (node as FolderNode).label,
                icon: 'folder',
                children: (node as FolderNode).children.map((child) =>
                    mapNode(child, currentKey)
                ),
                type: 'folder',
                id: currentKey,
            };
        } else {
            return {
                label: (node as ExperimentNode).label,
                icon: 'science',
                path: (node as ExperimentNode).path,
                type: 'experiment',
                id: (node as ExperimentNode).path,
            };
        }
    };
    return treeOptions.value.map((node) => mapNode(node));
});

watch(
    () => datasetSelectionTrrackedStore.currentExperimentFilename,
    (newVal) => {
        selectedNodeKey.value = newVal;
    },
    { immediate: true }
);

function onNodeSelected(target: string | null) {
    if (!target) return;

    // Find if the target is an experiment path
    const isExperiment = (nodes: any[]): boolean => {
        for (const node of nodes) {
            if (node.type === 'experiment' && node.id === target) return true;
            if (node.children && isExperiment(node.children)) return true;
        }
        return false;
    };

    if (isExperiment(mappedTreeNodes.value)) {
        selectExperiment(target);
    }
}
</script>

<template>
    <div class="experiment-selection-container">
        <div class="row items-center justify-between q-mb-sm">
            <span class="text-subtitle2">Select Experiment</span>
            <q-btn
                flat
                round
                dense
                icon="refresh"
                size="sm"
                @click="datasetSelectionStore.refreshFileNameList"
                :dark="globalSettings.darkMode"
            >
                <q-tooltip>Refresh Experiment List</q-tooltip>
            </q-btn>
        </div>

        <q-input
            outlined
            dense
            v-model="filter"
            placeholder="Search experiments..."
            class="q-mb-md search-bar"
            :dark="globalSettings.darkMode"
            clearable
        >
            <template v-slot:append>
                <q-icon name="search" />
            </template>
        </q-input>

        <div
            class="tree-scroll-container"
            :class="{ 'dark-mode': globalSettings.darkMode }"
        >
            <q-tree
                :nodes="mappedTreeNodes"
                node-key="id"
                label-key="label"
                :filter="filter"
                dense
                :dark="globalSettings.darkMode"
                v-model:selected="selectedNodeKey"
                @update:selected="onNodeSelected"
                no-connectors
            >
                <template v-slot:default-header="prop">
                    <div class="row items-center no-wrap">
                        <q-icon
                            :name="prop.node.icon"
                            :color="
                                prop.node.id === selectedNodeKey
                                    ? 'primary'
                                    : ''
                            "
                            size="18px"
                            class="q-mr-sm"
                        />
                        <div
                            :class="{
                                'text-primary text-weight-bold':
                                    prop.node.id === selectedNodeKey,
                            }"
                            class="ellipsis"
                        >
                            {{ prop.node.label }}
                        </div>
                    </div>
                </template>
            </q-tree>
        </div>
    </div>

    <div
        v-if="
            datasetSelectionStore.currentExperimentMetadata &&
            datasetSelectionStore.currentExperimentMetadata.locationMetadataList
                .length > 0
        "
        class="mt-3"
    >
        <span class="text-subtitle2">Imaging Locations</span>
        <q-list
            bordered
            separator
            :dark="globalSettings.darkMode"
            class="location-list mt-1"
        >
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
                class="location-item"
                ><q-item-section>{{
                    location.name ?? location.id
                }}</q-item-section></q-item
            >
        </q-list>
    </div>
</template>

<style scoped>
.experiment-selection-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 500px; /* Adjust as needed for the drawer */
}

.search-bar {
    flex-shrink: 0;
}

.tree-scroll-container {
    flex-grow: 1;
    overflow-y: auto;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.02);
}

.tree-scroll-container.dark-mode {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
}

.location-list {
    border-radius: 4px;
}

.location-item {
    min-height: 32px;
    font-size: 0.85rem;
}

.mt-1 {
    margin-top: 4px;
}

.mt-3 {
    margin-top: 12px;
}

:deep(.q-tree__node-header) {
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

:deep(.q-tree__node-header:hover) {
    background-color: rgba(0, 0, 0, 0.05);
}

.dark-mode :deep(.q-tree__node-header:hover) {
    background-color: rgba(255, 255, 255, 0.08);
}

/* Ensure long labels are truncated */
.ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
