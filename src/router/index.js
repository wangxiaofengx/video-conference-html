import { createRouter,createMemoryHistory, createWebHashHistory,createWebHistory } from 'vue-router'
import Index from '../components/index.vue'
import IM from '../components/im.vue'
import Home from '../components/home.vue'
import Demo from '../components/demo.vue'

const routes = [
    { path: '/', component: Index },
    { path: '/im', component: IM },
    { path: '/demo', component: Demo },
    { path: '/home', component: Home },
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
})

export default router