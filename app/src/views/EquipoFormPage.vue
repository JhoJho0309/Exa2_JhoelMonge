<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/equipos" text="" />
        </ion-buttons>
        <ion-title>{{ id ? 'Editar equipo' : 'Nuevo equipo' }}</ion-title>
      </ion-toolbar>
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: no es posible guardar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="guardar" novalidate>
        <ion-list lines="full">
          <ion-item>
            <ion-input v-model="datos.codigo" label="Código" label-placement="stacked" placeholder="EQ-0000"
              autocapitalize="characters" :maxlength="20" />
          </ion-item>
          <small v-if="errores.codigo" class="error-campo">{{ errores.codigo }}</small>

          <ion-item>
            <ion-input v-model="datos.nombre" label="Nombre" label-placement="stacked" :maxlength="120" />
          </ion-item>
          <small v-if="errores.nombre" class="error-campo">{{ errores.nombre }}</small>

          <ion-item>
            <ion-select v-model="datos.categoria_id" label="Categoría" label-placement="stacked"
              interface="action-sheet" placeholder="Seleccione" cancel-text="Cancelar">
              <ion-select-option v-for="c in listaCategorias" :key="c.id" :value="c.id">{{ c.nombre }}</ion-select-option>
            </ion-select>
          </ion-item>
          <small v-if="errores.categoria_id" class="error-campo">{{ errores.categoria_id }}</small>

          <ion-item v-if="estadoActual !== 'prestado'">
            <ion-select v-model="datos.estado" label="Estado" label-placement="stacked" interface="popover">
              <ion-select-option value="disponible">Disponible</ion-select-option>
              <ion-select-option value="mantenimiento">Mantenimiento</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item v-else>
            <ion-label>Estado: prestado (no se modifica desde aquí)</ion-label>
          </ion-item>
          <small v-if="errores.estado" class="error-campo">{{ errores.estado }}</small>

          <ion-item>
            <ion-input v-model="datos.fecha_adquisicion" label="Fecha de adquisición" label-placement="stacked"
              type="date" :max="hoy" />
          </ion-item>
          <small v-if="errores.fecha_adquisicion" class="error-campo">{{ errores.fecha_adquisicion }}</small>

          <ion-item>
            <ion-input v-model="datos.costo_interno" label="Costo interno (₡)" label-placement="stacked"
              type="number" inputmode="decimal" :min="0"
              :helper-text="id ? 'La API no expone este dato: vuelva a ingresarlo.' : undefined" />
          </ion-item>
          <small v-if="errores.costo_interno" class="error-campo">{{ errores.costo_interno }}</small>
        </ion-list>

        <ion-button type="submit" expand="block" class="ion-margin-top" :disabled="!conectado">
          Guardar
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonList, IonItem,
  IonInput, IonSelect, IonSelectOption, IonButton, IonLabel,
  loadingController, onIonViewWillEnter, useIonRouter,
} from '@ionic/vue';
import { actualizar, categorias, crear, obtener, type Categoria, type DatosEquipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

// id llega por props: true en la ruta equipos/:id/editar; en equipos/nuevo es undefined
const props = defineProps<{ id?: string }>();
const id = props.id;

const ionRouter = useIonRouter();
const { conectado } = useConexion();
const hoy = new Date().toISOString().slice(0, 10);

const datos = reactive<DatosEquipo>({
  codigo: '', nombre: '', categoria_id: null, estado: 'disponible', fecha_adquisicion: hoy, costo_interno: null,
});
const listaCategorias = ref<Categoria[]>([]);
const estadoActual = ref<Estado>('disponible');
const errores = ref<Record<string, string>>({});

onIonViewWillEnter(async () => {
  errores.value = {};
  try {
    listaCategorias.value = await categorias();

    if (!id) {
      Object.assign(datos, {
        codigo: '',
        nombre: '',
        categoria_id: null,
        estado: 'disponible',
        fecha_adquisicion: hoy,
        costo_interno: null,
      });
      estadoActual.value = 'disponible';
    } else {
      const equipo = await obtener(Number(id));

      // La API devuelve `categoria: { id, nombre }`, no `categoria_id`:
      // se copian los campos de forma explícita para que el select quede seleccionado.
      Object.assign(datos, {
        codigo: equipo.codigo,
        nombre: equipo.nombre,
        categoria_id: equipo.categoria?.id ?? null,
        estado: equipo.estado === 'prestado' ? 'disponible' : equipo.estado,
        fecha_adquisicion: equipo.fecha_adquisicion,
        costo_interno: null, // la API no expone el costo: hay que volver a ingresarlo
      });
      estadoActual.value = equipo.estado;
    }
  } catch (error) {
    const e = error as ErrorApi;
    if (e.status === 404) {
      mostrarToast('Equipo no encontrado.', 'warning');
      ionRouter.replace('/tabs/equipos');
    } else if (e.status !== 401) {
      mostrarToast('Error al cargar datos.', 'danger');
    }
  }
});

// El input type="number" entrega string: vacío debe viajar como null (no como 0)
// para que la API responda 422 "El costo interno es obligatorio".
function costoComoNumero(): number | null {
  const crudo = datos.costo_interno as unknown;
  if (crudo === null || crudo === undefined || String(crudo).trim() === '') return null;
  const n = Number(crudo);
  return Number.isNaN(n) ? null : n;
}

async function guardar() {
  const loading = await loadingController.create({ message: 'Guardando…' });
  await loading.present();

  errores.value = {};

  try {
    const cuerpo: DatosEquipo = {
      codigo: datos.codigo.trim().toUpperCase(),
      nombre: datos.nombre.trim(),
      categoria_id: datos.categoria_id,
      fecha_adquisicion: datos.fecha_adquisicion,
      costo_interno: costoComoNumero(),
      ...(estadoActual.value !== 'prestado' && { estado: datos.estado }),
    };

    if (!id) {
      await crear(cuerpo);
    } else {
      await actualizar(Number(id), cuerpo);
    }

    vibrar();
    mostrarToast('Guardado exitoso.', 'success');

    if (!ionRouter.canGoBack()) {
      ionRouter.push('/tabs/equipos');
    } else {
      ionRouter.back();
    }
  } catch (error) {
    const e = error as ErrorApi;
    if (e.status === 422 && e.cuerpo?.errors) {
      errores.value = e.erroresPorCampo;
    } else if (e.status === 404) {
      mostrarToast('El equipo ya no existe.', 'warning');
    } else if (e.status !== 401) {
      mostrarToast('Error inesperado al guardar.', 'danger');
    }
  } finally {
    loading.dismiss();
  }
}
</script>

<style scoped>
.error-campo {
  color: var(--ion-color-danger);
  font-size: 0.8rem;
  margin-left: 12px;
}
</style>