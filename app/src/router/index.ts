import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';
import { useAuth } from '@/composables/useAuth';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/equipos' },
  {
    path: '/login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { soloInvitados: true },
  },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiereSesion: true },
    children: [
      { path: '', redirect: '/tabs/equipos' },
      { path: 'equipos', component: () => import('@/views/EquiposPage.vue') },
      { path: 'equipos/nuevo', component: () => import('@/views/EquipoFormPage.vue') },
      {
        path: 'equipos/:id/editar',
        component: () => import('@/views/EquipoFormPage.vue'),
        props: true,
      },
      { path: 'perfil', component: () => import('@/views/PerfilPage.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

const { cargarToken, estaAutenticado } = useAuth();

router.beforeEach(async (to) => {
  await cargarToken();

  const requiereSesion = to.matched.some(
    (record) => record.meta.requiereSesion === true,
  );
  const soloInvitados = to.matched.some(
    (record) => record.meta.soloInvitados === true,
  );

  if (requiereSesion && !estaAutenticado.value) {
    return '/login';
  }

  if (soloInvitados && estaAutenticado.value) {
    return '/tabs/equipos';
  }

  return true;
});

export default router;