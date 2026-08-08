/**
 * Guardas de ejecución de herramientas: timeout y deduplicación.
 * Separadas en su propio módulo para poder testearlas sin BD.
 */

/**
 * Envuelve una promesa con timeout. Si expira, rechaza.
 */
export function conTimeout<T>(promise: Promise<T>, ms: number, mensaje?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(mensaje ?? `Timeout tras ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Firma estable de una invocación de herramienta: ordena las claves de args
 * para que dos llamadas con el mismo contenido colisionen igual.
 */
export function firmaHerramienta(name: string, args: Record<string, unknown>): string {
  const ordenado = Object.keys(args)
    .sort()
    .reduce((acc, k) => {
      (acc as Record<string, unknown>)[k] = args[k];
      return acc;
    }, {} as Record<string, unknown>);
  return `${name}:${JSON.stringify(ordenado)}`;
}

export interface Dedup {
  yaEjecutada(firma: string): boolean;
  marcar(firma: string): void;
}

/**
 * Deduplicador por firma con TTL y limpieza oportunista.
 * Útil para herramientas mutantes: evita que un functionCall repetido
 * (retry de red, modelo ansioso) ejecute la operación dos veces.
 */
export function crearDedup(ttlMs: number = 90000): Dedup {
  const recientes = new Map<string, number>();

  const limpiar = (ahora: number) => {
    if (recientes.size <= 200) return;
    for (const [k, v] of recientes) {
      if (ahora - v > ttlMs) recientes.delete(k);
    }
  };

  return {
    yaEjecutada(firma: string): boolean {
      const t = recientes.get(firma);
      if (t !== undefined && Date.now() - t < ttlMs) return true;
      return false;
    },
    marcar(firma: string): void {
      const ahora = Date.now();
      recientes.set(firma, ahora);
      limpiar(ahora);
    },
  };
}
