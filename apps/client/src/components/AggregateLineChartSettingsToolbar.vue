<script setup lang="ts">
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useGlobalSettings } from '@/stores/componentStores/globalSettingsStore';
import { useAggregateLineChartStore } from '@/stores/componentStores/aggregateLineChartStore';
import { matFileDownload } from '@quasar/extras/material-icons'
import { toSvg } from 'html-to-image';


const cellMetaData = useCellMetaData();
const aggregateLineChartStore = useAggregateLineChartStore();
const globalSettings = useGlobalSettings();




function downloadSvg(): void {
  const element = document.getElementById('aggLineChartSvg');
  if (!(element instanceof SVGElement)) {
    console.error('SVG element not found!');
    return;
  }
  
  // Create a style element with all necessary CSS
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .agg-line {
      stroke-width: 3px;
      stroke-linejoin: round;
      opacity: 0.95;
    }
    .left.agg-line {
      stroke: #1b9e77;
      fill: #1b9e77;
    }
    .right.agg-line {
      stroke: #7570b3;
      fill: #7570b3;
    }
    .muted.agg-line {
      stroke-width: 1px;
      opacity: 0.6;
    }
    .highlighted.agg-line {
      stroke-width: 3px;
      opacity: 1;
    }
    .selected.agg-line {
      stroke-width: 4px;
    }
    .hovered.agg-line {
      stroke-width: 6px;
    }
    .connection.agg-line {
      stroke-dasharray: 4.5 6;
      stroke-width: 1.5px;
      opacity: 0.7;
    }
    .hovered.time.agg-line,
    .current.time.agg-line {
      stroke: rgb(130, 130, 130);
    }
    /* If your globalSettings.normalizedDark uses "dark" or "light" classes, include them: */
    .dark {
      stroke: #377eb8;
      fill: #377eb8;
    }
    .light {
      stroke: #377eb8;
      fill: #377eb8;
    }
    .dark.selected {
      stroke: #e29609;
      fill: #e29609;
    }
    .light.selected {
      stroke: #fde309;
      fill: #fde309;
    }
    .dark.hovered,
    .light.hovered {
      stroke: #ffcf76;
      fill: #ffcf76;
    }
  `;
  
  // Prepend styleElement to the SVG element so that these styles apply
  element.insertBefore(styleElement, element.firstChild);
  
  // Convert the element to an SVG data URL using html-to-image
  toSvg(element as unknown as HTMLElement)
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = 'aggregateLineChart.svg';
      link.href = dataUrl;
      link.click();
      element.removeChild(styleElement);
    })
    .catch((err) => {
      console.error('oops, something went wrong!', err);
    });
}

</script>

<template>
    <q-select
        label="Attribute"
        class="min-w-75"
        dense
        v-model="aggregateLineChartStore.attributeKey"
        :options="cellMetaData.cellNumAttributeHeaderNames"
        :dark="globalSettings.darkMode"
    ></q-select>
    <q-btn 
    round
    flat
    :icon="matFileDownload" 
    @click="downloadSvg" />
</template>

<style scoped lang="scss">
.min-w-75 {
    min-width: 75px;
}
</style>
