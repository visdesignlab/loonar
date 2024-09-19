import { ref } from 'vue';
import { defineStore } from 'pinia';
import mitt from 'mitt';

export const useEventBusStore = defineStore('eventBusStore', () => {
    const emitter = ref(mitt());

    return { emitter };
});
