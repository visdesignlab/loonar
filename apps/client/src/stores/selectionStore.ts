import { defineStore } from 'pinia';

interface Selection {
    plotName: string;
    range: [string, string];
}
interface Plot {
    plotName: string;
}

export const useSelectionStore = defineStore('Selection', {
    state: () => ({
        Selections: [] as Selection[],
        Plots: [] as Plot[],
    }),
    actions: {
        addSelection(selection: Selection) {
            const existingIndex = this.Selections.findIndex(
                (s) => s.plotName === selection.plotName
            );
            if (existingIndex !== -1) {
                this.Selections[existingIndex] = selection;
            } else {
                this.Selections.push(selection);
            }
        },
        removeSelection(index: number) {
            this.Selections.splice(index, 1);
        },
        updateSelection(plotName: string, range: [string, string]) {
            const existingIndex = this.Selections.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.Selections[existingIndex].range = range;
            } else {
                this.addSelection({ plotName, range });
            }
        },
        removeSelectionByPlotName(plotName: string) {
            const index = this.Selections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index !== -1) {
                window.dispatchEvent(
                    new CustomEvent('selectionRemoved', { detail: plotName })
                );
                this.removeSelection(index);
            }
        },
        addPlot(plot: Plot) {
            const existingIndex = this.Plots.findIndex(
                (s) => s.plotName === plot.plotName
            );
            if (existingIndex !== -1) {
                this.Plots[existingIndex] = plot;
            } else {
                this.Plots.push(plot);
            }
        },
    },
});
