import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export interface ExemplarTrack {
    trackId: string;
    locationId: string;
    minTime: number;
    maxTime: number;
    data: DataPoint[];
    tags: Record<string, string>;
    p: number; // the sample position, e.g. median has p=0.5
    pinned: boolean; // true if this is a user pinned exemplar
    starred: boolean; // true if this is a user starred exemplar
}

export interface DataPoint {
    time: number;
    frame: number;
    value: number;
}

export interface ViewConfiguration {
    afterStarredGap: number;
    snippetDisplayHeight: number;
    snippetHorizonChartGap: number;
    horizonChartHeight: number;
    horizonChartWidth: number;
    horizonTimeBarGap: number;
    timeBarHeightOuter: number;
    timeBarHeightInner: number;
    betweeenExemplarGap: number;
    betweenConditionGap: number;
}

export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {
    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
        snippetDisplayHeight: 50,
        snippetHorizonChartGap: 10,
        horizonChartHeight: 40,
        horizonChartWidth: 1000,
        horizonTimeBarGap: 8,
        timeBarHeightOuter: 20,
        timeBarHeightInner: 10,
        betweeenExemplarGap: 20,
        betweenConditionGap: 200,
    });

    const exemplarHeight = computed(() => {
        return (
            viewConfiguration.value.snippetDisplayHeight +
            viewConfiguration.value.snippetHorizonChartGap +
            viewConfiguration.value.horizonChartHeight +
            viewConfiguration.value.horizonTimeBarGap +
            viewConfiguration.value.timeBarHeightOuter
        );
    });

    const exemplarTracks = ref<ExemplarTrack[]>([]);
    generateTestExemplarTracks();

    function generateTestExemplarTracks(): void {
        exemplarTracks.value = [];
        for (const drug of ['drug1', 'drug2', 'drug3']) {
            for (const conc of ['0.1', '0.2', '0.3']) {
                for (const p of [0.1, 0.5, 0.9]) {
                    exemplarTracks.value.push(
                        generateTestExemplarTrack(drug, conc, p)
                    );
                }
            }
        }
    }

    function generateTestExemplarTrack(
        drug: string,
        conc: string,
        p: number
    ): ExemplarTrack {
        const data: DataPoint[] = [];
        const trackLength = 10 + Math.round(Math.random() * 100);
        const tstart = Math.round(Math.random() * 50);
        let minTime = Infinity;
        let maxTime = -Infinity;
        for (let i = 0; i < trackLength; i++) {
            const time = tstart + i + 0.2 * Math.random();
            minTime = Math.min(minTime, time);
            maxTime = Math.max(maxTime, time);
            data.push({
                time,
                frame: tstart + i,
                value: 100 + Math.random() * 1000,
            });
        }
        return {
            trackId: `${drug}-${conc}-${p}`, // fake, but fine for now
            locationId: `${drug}-${conc}`, // fake, but fine for now
            minTime,
            maxTime,
            data,
            tags: {
                drug: drug,
                conc: conc,
            },
            p,
            pinned: false,
            starred: false,
        };
    }

    return {
        generateTestExemplarTracks,
        exemplarTracks,
        viewConfiguration,
        exemplarHeight,
    };
});
