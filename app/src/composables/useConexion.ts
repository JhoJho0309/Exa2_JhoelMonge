import { onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';

export function useConexion() {
  const conectado = ref(false);
  const tipo = ref('unknown');

  let destruido = false;
  let cambioRecibido = false;
  let quitarOyente: (() => void) | undefined;

  const oyente = Network.addListener('networkStatusChange', (estado) => {
    cambioRecibido = true;
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  });

  void oyente
    .then((handle) => {
      if (destruido) {
        void handle.remove();
      } else {
        quitarOyente = () => {
          void handle.remove();
        };
      }
    })
    .catch(() => {
      // La vista conserva el último estado conocido si no se pudo registrar el oyente.
    });

  void Network.getStatus()
    .then((estado) => {
      if (!destruido && !cambioRecibido) {
        conectado.value = estado.connected;
        tipo.value = estado.connectionType;
      }
    })
    .catch(() => {
      conectado.value = false;
      tipo.value = 'unknown';
    });

  onUnmounted(() => {
    destruido = true;
    quitarOyente?.();
  });

  return { conectado, tipo };
}

export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Si el dispositivo no permite hápticos, la acción principal sigue funcionando.
  }
}