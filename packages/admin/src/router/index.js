import { createRouter, createWebHashHistory } from 'vue-router'
import { auth } from '../stores/auth.js'

import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import ContentList from '../views/ContentList.vue'
import ContentEdit from '../views/ContentEdit.vue'
import ApiKeys from '../views/ApiKeys.vue'

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: Dashboard },
  { path: '/content/:type', component: ContentList, props: true },
  { path: '/content/:type/new', component: ContentEdit, props: true },
  { path: '/content/:type/:id', component: ContentEdit, props: true },
  { path: '/apikeys', component: ApiKeys }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (!to.meta.public && !auth.isLoggedIn) {
    return '/login'
  }
})

export default router
