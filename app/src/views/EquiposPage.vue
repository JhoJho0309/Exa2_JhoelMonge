<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>

        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <ion-toolbar>
        <ion-searchbar
          v-model="q"
          :debounce="400"
          placeholder="Buscar por código o nombre"
          @ion-input="buscar"
        />
      </ion-toolbar>

      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">
          Sin conexión: los datos pueden estar desactualizados
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <ion-list v-if="cargando && equipos.length === 0">
        <ion-item v-for="n in 5" :key="n">
          <ion-label>
            <ion-skeleton-text :animated="true" style="width: 65%" />
            <ion-skeleton-text :animated="true" style="width: 40%" />
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-else-if="error" class="ion-padding">
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">Reintentar</ion-button>
      </div>

      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" />
        <p>No se encontraron equipos.</p>
      </div>

      <ion-list v-else>
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item :router-link="`/tabs/equipos/${equipo.id}/editar`">
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria?.nombre }}</p>
            </ion-label>

            <ion-badge slot="end" :color="colorEstado[equipo.estado]">
              {{ equipo.estado }}
            </ion-badge>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option
              color="danger"
              @click="confirmarEliminacion(equipo, $event)"
            >
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-infinite-scroll
        :disabled="!hayMas || Boolean(error)"
        @ionInfinite="cargarMas"
      >
        <ion-infinite-scroll-content
          loading-spinner="bubbles"
          loading-text="Cargando más equipos..."
        />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonItem,
  IonLabel,
  IonSkeletonText,
  IonBadge,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue';
import type {
  InfiniteScrollCustomEvent,
  RefresherCustomEvent,
} from '@ionic/vue';
import {
  add,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  eliminar,
  listar,
  type Equipo,
  type Estado,
} from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = {
  disponible: 'success',
  prestado: 'warning',
  mantenimiento: 'medium',
};

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');

const hayMas = computed(() => pagina.value < ultimaPagina.value);

// Evita que una respuesta antigua reemplace resultados de una búsqueda nueva.
let numeroSolicitud = 0;

async function cargar(reiniciar = false) {
  if (cargando.value && !reiniciar) return;

  const miSolicitud = ++numeroSolicitud;
  const paginaSolicitada = reiniciar ? 1 : pagina.value + 1;

  cargando.value = true;
  error.value = '';

  try {
    const respuesta = await listar(paginaSolicitada, q.value);

    if (miSolicitud !== numeroSolicitud) return;

    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;

    if (reiniciar) {
      equipos.value = respuesta.data;
    } else {
      equipos.value.push(...respuesta.data);
    }
  } catch (err) {
    if (miSolicitud !== numeroSolicitud) return;

    const e = err as ErrorApi;
    if (e.status !== 401) {
      error.value = e.cuerpo?.mensaje ?? 'Error al cargar equipos.';
    }
  } finally {
    if (miSolicitud === numeroSolicitud) {
      cargando.value = false;
    }
  }
}

// Recarga la lista cada vez que se vuelve a esta página.
onIonViewWillEnter(() => {
  void cargar(true);
});

function buscar() {
  void cargar(true);
}

async function refrescar(evento: RefresherCustomEvent) {
  await cargar(true);
  evento.target.complete();
}

async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    if (hayMas.value) {
      await cargar(false);
    }
  } finally {
    evento.target.complete();
  }
}

async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const objetivo = evento.target;
  const sliding =
    objetivo instanceof Element
      ? (objetivo.closest('ion-item-sliding') as
          | (HTMLElement & { close: () => Promise<void> })
          | null)
      : null;

  await sliding?.close();

  const alerta = await alertController.create({
    header: 'Confirmar eliminación',
    message: `¿Eliminar el equipo "${equipo.nombre}"?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });

  await alerta.present();

  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);

    equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
    await vibrar();
    await mostrarToast('Equipo eliminado con éxito', 'success');
  } catch (err) {
    const e = err as ErrorApi;

    if (e.status === 409) {
      await mostrarToast(
        e.cuerpo?.mensaje ?? 'No se puede eliminar un equipo prestado.',
        'warning',
      );
    } else if (e.status === 404) {
      equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
      await mostrarToast('El equipo ya no existe.', 'warning');
    } else if (e.status !== 401) {
      await mostrarToast('Error inesperado al eliminar.', 'danger');
    }
  }
}
</script>