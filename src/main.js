import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import './assets/base.css'
import router from './router'

createApp(App).use(ElementPlus, {
	locale: zhCn,
}).use(router).mount('#app')
