import { defineStore } from 'pinia';

interface Filter {
    plotName: string;
    range: [number, number];
}

export const useFilterStore = defineStore('filter', {
    state: () => ({
        filters: [] as Filter[],
    }),
    actions: {
        addFilter(filter: Filter) {
            const existingIndex = this.filters.findIndex(
                (s) => s.plotName === filter.plotName
            );
            if (existingIndex !== -1) {
                this.filters[existingIndex] = filter;
            } else {
                this.filters.push(filter);
            }
        },
        removeFilter(index: number) {
            this.filters.splice(index, 1);
        },
        updateFilter(plotName: string, range: [number, number]) {
            const existingIndex = this.filters.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.filters[existingIndex].range = range;
            } else {
                this.addFilter({ plotName, range });
            }
        },
        clearAllFilters() {
            this.filters = [];
        },
    },
});
