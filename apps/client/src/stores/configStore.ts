import { defineStore } from 'pinia';

export const useConfigStore = defineStore('configStore',() => {
    let environment = import.meta.env.VITE_ENVIRONMENT;
    if(environment === undefined){
        environment = 'production'
    }
    return{
        environment
    }
})