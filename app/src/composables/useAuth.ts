import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

/** Borrar token y usuario de la memoria (refs) y del almacenamiento cifrado. */
export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  await SecureStorage.remove(CLAVE_TOKEN);
  await SecureStorage.remove(CLAVE_USUARIO);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  /** login con email y password */
  async function login(email: string, password: string) {
    // Obtener info del dispositivo
    const info = await Device.getInfo();
    const plataforma = info.platform ?? 'unknown';
    const modelo = (info.model ?? 'unknown').slice(0, 60);
    const device_name = `${plataforma} ${modelo}`.slice(0, 60);

    // Solicitar inicio de sesión a la API
    const respuesta = await api<{
      token: string;
      usuario: Usuario;
    }>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    // Guardar token y usuario en memoria
    token.value = respuesta.token;
    usuario.value = respuesta.usuario;

    // Guardar en almacenamiento seguro
    await SecureStorage.set(CLAVE_TOKEN, respuesta.token);
    await SecureStorage.set(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
  }

  /** cargar token y usuario de almacenamiento seguro, una sola vez */
  async function cargarToken() {
    if (tokenCargado) return;
    tokenCargado = true;

    const t = await SecureStorage.get(CLAVE_TOKEN);
    const u = await SecureStorage.get(CLAVE_USUARIO);

    if (t) token.value = t;
    if (u) {
      try {
        usuario.value = JSON.parse(u);
      } catch {
        usuario.value = null;
      }
    }
  }

  /** cerrar sesión: revocar en API y borrar localmente siempre */
  async function cerrarSesion() {
    try {
      if (token.value) {
        await api('/logout', { method: 'POST' });
      }
    } catch {
      // Ignorar errores para siempre borrar local
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}
