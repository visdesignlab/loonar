import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import HorizonChart from './components/HorizonChart.vue';
import DatasetSelector from './components/globalSettings/DatasetSelector.vue';
import LayoutSelector from './components/globalSettings/LayoutSelector.vue';
import GeneralSettings from './components/globalSettings/GeneralSettings.vue';
import StubView from './components/globalSettings/StubView.vue';
import FilterSelector from './components/plotSelector/FilterSelector.vue';
// import LooneageView from './components/LooneageView.vue';
import CellTrackView from './components/CellTrackView.vue';
import LooneageViewGL from './components/LooneageViewGL.vue';
import LooneageViewSettingsSidebar from './components/LooneageViewSettingsSidebar.vue';
import LooneageViewSettingsToolbar from './components/LooneageViewSettingsToolbar.vue';
import BasicInfo from './components/BasicInfo.vue';
import SimpleTable from './components/SimpleTable.vue';
import ImageViewer from './components/ImageViewer.vue';
import ImageViewerSettingsSidebar from './components/ImageViewerSettingsSidebar.vue';
import ImageViewerSettingsToolbar from './components/ImageViewerSettingsToolbar.vue';
import AggregateLineChart from './components/AggregateLineChart.vue';
import AggregateLineChartSettingsSidebar from './components/AggregateLineChartSettingsSidebar.vue';
import AggregateLineChartSettingsToolbar from './components/AggregateLineChartSettingsToolbar.vue';
import ExemplarViewSettingsSidebar from '@/components/exemplarView/ExemplarViewSettingsSidebar.vue';
import TrrackVisWrapper from './components/TrrackVisWrapper.vue';
import NoDataSplash from './components/NoDataSplash.vue';
import ConditionSelector from './components/conditionSelector/ConditionSelector.vue';
import ExemplarView from './components/exemplarView/ExemplarView.vue';
import ExemplarViewSettingsToolbar from './components/exemplarView/ExemplarViewSettingsToolbar.vue';
import { router } from './router';

import { Quasar, Loading, Notify } from 'quasar';
// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css';

// Import Quasar css
import 'quasar/src/css/index.sass';

// Vuetify
import 'vuetify/styles';

import './App.scss';

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core';

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

/* import specific icons */
import { fas } from '@fortawesome/free-solid-svg-icons';
// import { faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';

/* add icons to the library */
library.add(fas);

// @ts-ignore
createApp(App)
    .use(router)
    .use(createPinia())
    .use(Quasar, {
        plugins: { Loading, Notify }, // import Quasar plugins and add here,
        config: {
            loading: {
                delay: 0,
                /* look at QuasarConfOptions from the API card.
                https://quasar.dev/quasar-plugins/loading#api--loading */
            },
        },
    })
    .component('font-awesome-icon', FontAwesomeIcon)
    .component('HorizonChart', HorizonChart)
    .component('DatasetSelector', DatasetSelector)
    .component('LayoutSelector', LayoutSelector)
    .component('GeneralSettings', GeneralSettings)
    .component('ImageViewerSettingsSidebar', ImageViewerSettingsSidebar)
    .component('ImageViewerSettingsToolbar', ImageViewerSettingsToolbar)
    .component('ImageViewer', ImageViewer)
    .component('AggregateLineChart', AggregateLineChart)
    .component(
        'AggregateLineChartSettingsSidebar',
        AggregateLineChartSettingsSidebar
    )
    .component(
        'AggregateLineChartSettingsToolbar',
        AggregateLineChartSettingsToolbar
    )
    .component('ExemplarViewSettingsSidebar', ExemplarViewSettingsSidebar)
    .component('TrrackVisWrapper', TrrackVisWrapper)
    // .component('LooneageView', LooneageView)
    .component('CellTrackView', CellTrackView)
    .component('LooneageViewGL', LooneageViewGL)
    .component('LooneageViewSettingsSidebar', LooneageViewSettingsSidebar)
    .component('LooneageViewSettingsToolbar', LooneageViewSettingsToolbar)
    .component('BasicInfo', BasicInfo)
    .component('SimpleTable', SimpleTable)
    .component('NoDataSplash', NoDataSplash)
    .component('StubView', StubView)
    .component('FilterSelector', FilterSelector)
    .component('ConditionSelector', ConditionSelector)
    .component('ExemplarView', ExemplarView)
    .component('ExemplarViewSettingsToolbar', ExemplarViewSettingsToolbar)
    .mount('#app');
