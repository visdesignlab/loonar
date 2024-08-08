import { defineStore } from 'pinia';

interface filter {
    plotName: string;
    range: [string, string];
}

export const useFilterStore = defineStore('filter', {
    state: () => ({
        filters: [] as filter[],
    }),
    actions: {
        addFilter(filter: filter) {
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
        updateFilter(plotName: string, range: [string, string]) {
            const existingIndex = this.filters.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.filters[existingIndex].range = range;
            } else {
                this.addFilter({ plotName, range });
            }
        },
    },
});
