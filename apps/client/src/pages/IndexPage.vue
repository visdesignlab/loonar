<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import GridstackLayout from '@/components/GridstackLayout.vue';
import GlobalSettingsView from '@/components/globalSettings/GlobalSettingsView.vue';
</script>
<template>
    <q-page>
        <div class="d-flex flex-row">
            <div class="vh-100 sticky-top">
                <GlobalSettingsView></GlobalSettingsView>
            </div>
            <div class="flex-grow-1">
                <GridstackLayout></GridstackLayout>
            </div>
        </div>
    </q-page>
</template>
