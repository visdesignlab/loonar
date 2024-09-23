import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { isEqual, every, sortBy } from 'lodash-es';
import { useDataPointSelection } from '../interactionStores/dataPointSelectionTrrackedStore';
import { extent as d3Extent } from 'd3-array';
import type { AnyAttributes, TextTransforms } from '@/util/datasetLoader';

export const useExperimentCellMetaData = defineStore(
    'experimentCellMetaData',
    () => {
        // Declare variables to expose here

        function init(
            rawData: AnyAttributes[],
            columnHeaders: string[],
            headerTransforms?: TextTransforms
        ) {
            console.log('Initializing Experiment Data');

            // Initialize store with appropriate data
        }

        return {
            init,
            // Return variables needed to access
        };
    }
);
