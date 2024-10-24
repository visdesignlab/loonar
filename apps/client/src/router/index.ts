import { createMemoryHistory, createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import IndexPage from '../pages/IndexPage.vue'
import UploadPage from '../pages/UploadPage.vue'
import TestPage from '@/pages/TestPage.vue';


const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: IndexPage,
  },
  {
    path: "/upload",
    component: UploadPage
  },
  {
    path: "/test",
    component: TestPage
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: IndexPage,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
