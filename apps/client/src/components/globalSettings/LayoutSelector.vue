<script setup lang="ts">
import {
    useGridstackLayoutStore,
    type Layout,
} from '@/stores/interactionStores/gridstackLayoutStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { nextTick } from 'vue';

const gridstackLayoutStore = useGridstackLayoutStore();
const globalSettings = useGlobalSettings();
function listItemClass(layout: Layout): string {
    return `fake-button d-flex align-items-center list-group-item ${
        layout.id == gridstackLayoutStore.currentLayout?.id ? 'active' : ''
    }`;
}

function buttonIconClass(layout: Layout): string {
    return `hover-show btn btn-sm btn-outline-${
        layout.id == gridstackLayoutStore.currentLayout?.id
            ? 'light'
            : globalSettings.btnDark
    }`;
}

function makeNameEditable(layout: Layout | null): void {
    if (layout == null) return;
    layout.editing = true;
    nextTick(() => {
        const elId = inputNameId(layout);
        const element = document.getElementById(elId) as HTMLInputElement;
        element?.focus();
        element?.select();
    });
}

function onCreateNew(): void {
    gridstackLayoutStore.$patch(() => {
        gridstackLayoutStore.createNew();
        makeNameEditable(gridstackLayoutStore.currentLayout);

    });
}

function inputNameId(layout: Layout): string {
    return `name-input-${layout.id}`;
}
</script>

<template>
    <ul class="list-group">
        <li
            v-for="(layout, index) in gridstackLayoutStore.systemLayoutOptions"
            :key="index"
            :class="listItemClass(layout)"
            @click="() => gridstackLayoutStore.resetLayout(layout)"
        >
            <span>{{ layout.name }}</span>
            <span class="flex-grow-1"></span>
            <font-awesome-icon class="hover-show" icon="fa-solid fa-lock" />
        </li>
        <li
            v-for="(layout, index) in gridstackLayoutStore.userLayoutOptions"
            :key="index"
            :class="listItemClass(layout)"
            @click="() => gridstackLayoutStore.resetLayout(layout)"
        >
            <span v-if="!layout.editing" class="me-1">{{ layout.name }}</span>
            <input
                v-else
                v-model.lazy="layout.name"
                type="text"
                :id="inputNameId(layout)"
                @focusout="
                    gridstackLayoutStore.$patch(() => (layout.editing = false))
                "
                @keyup.enter="
                    gridstackLayoutStore.$patch(() => (layout.editing = false))
                "
            />
            <button
                v-if="!layout.editing"
                :class="buttonIconClass(layout)"
                @click.stop="makeNameEditable(layout)"
            >
                <font-awesome-icon icon="fa-solid fa-pencil" />
            </button>
            <span class="flex-grow-1"></span>
            <button
                v-if="!layout.editing"
                :class="buttonIconClass(layout)"
                @click.stop="
                    () =>
                        gridstackLayoutStore.$patch(() =>
                            gridstackLayoutStore.deleteLayout(index)
                        )
                "
            >
                <font-awesome-icon icon="fa-solid fa-trash-can" />
            </button>
        </li>
    </ul>

    <div class="mt-4 d-flex flex-column">
        <div class="btn-group" role="group">
            <button
                :class="`btn btn-outline-${globalSettings.btnDark}`"
                @click="onCreateNew"
            >
                Create New
            </button>
            <button
                v-if="gridstackLayoutStore.currentLayout?.editable"
                :class="`btn btn-outline-${globalSettings.btnDark}`"
                @click="gridstackLayoutStore.updateCurrent"
            >
                Update Current
            </button>
        </div>
    </div>
</template>
<style scoped lange="scss">
.hover-show {
    visibility: hidden;
}

li:hover .hover-show {
    visibility: visible;
}

.fake-button {
    user-select: none;
    cursor: pointer;
}
</style>
