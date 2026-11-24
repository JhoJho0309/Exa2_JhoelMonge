import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  // Construir URL con query params válidos
  const url = new URL(BASE_URL + ruta);
  if (opciones.params) {
    for (const [clave, valor] of Object.entries(opciones.params)) {
      if (valor !== undefined && valor !== '') {
        url.searchParams.append(clave, String(valor));
      }
    }
  }

  // Preparar headers
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = await obtenerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Preparar configuración fetch
  const config: RequestInit = {
    method: opciones.method ?? 'GET',
    headers,
  };

  if (opciones.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(opciones.body);
  }

  // AbortController para timeout
  const controlador = new AbortController();
  config.signal = controlador.signal;

  const timeoutId = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), config);
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Si falla sin respuesta (timeout, red, CORS)
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  }
  clearTimeout(timeoutId);

  // Si status 204 (No Content)
  if (response.status === 204) {
    return null as unknown as T;
  }

  // Intentar parsear JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // Manejo de errores HTTP
  if (!response.ok) {
    if (response.status === 401 && ruta !== '/login') {
      await olvidarSesion();
      router.replace('/login');
    }
    throw new ErrorApi(response.status, data);
  }

  // Respuesta exitosa
  return data as T;
}
