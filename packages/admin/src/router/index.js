import { createRouter, createWebHashHistory } from 'vue-router'
import { auth } from '../stores/auth.js'

import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import ContentList from '../views/ContentList.vue'
import ContentEdit from '../views/ContentEdit.vue'
import ApiKeys from '../views/ApiKeys.vue'
import Media from '../views/Media.vue'
import Settings from '../views/Settings.vue'
import AuditLog from '../views/AuditLog.vue'
import Webhooks from '../views/Webhooks.vue'
import Pipelines from '../views/Pipelines.vue'
import Workflow from '../views/Workflow.vue'
import Revisions from '../views/Revisions.vue'
import Users from '../views/Users.vue'
import Categories from '../views/Categories.vue'
import Theme from '../views/Theme.vue'

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: Dashboard },
  { path: '/content/:type', component: ContentList, props: true },
  { path: '/content/:type/new', component: ContentEdit, props: true },
  { path: '/content/:type/:id', component: ContentEdit, props: true },
  { path: '/content/:type/:id/revisions', component: Revisions, props: true },
  { path: '/apikeys', component: ApiKeys },
  { path: '/media', component: Media },
  { path: '/settings', component: Settings },
  { path: '/audit', component: AuditLog },
  { path: '/webhooks', component: Webhooks },
  { path: '/pipelines', component: Pipelines },
  { path: '/workflow', component: Workflow },
  { path: '/users', component: Users },
  { path: '/categories', component: Categories },
  { path: '/theme', component: Theme }
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
