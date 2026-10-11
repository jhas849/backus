import { Injectable } from '@angular/core';

export interface Pedido {
  id: number;
  producto: string;
  precio: number;
  fecha: string;
  estado: string;
}

export interface Mensaje {
  id?: number;
  texto: string;
  fecha: string;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly dbName = 'backusVentasDB';
  private readonly dbVersion = 2;
  private readonly pedidosStore = 'pedidos';
  private readonly mensajesStore = 'mensajes';

  abrirDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB no está disponible.'));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.pedidosStore)) {
          db.createObjectStore(this.pedidosStore, {
            keyPath: 'id',
            autoIncrement: true
          });
        }

        if (!db.objectStoreNames.contains(this.mensajesStore)) {
          db.createObjectStore(this.mensajesStore, {
            keyPath: 'id',
            autoIncrement: true
          });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(
        new Error('La actualización de IndexedDB está bloqueada por otra pestaña.')
      );
    });
  }

  async migrarDatosLocales(): Promise<void> {
    const pedidosAntiguos = this.leerDatosLocales<Pedido>('backusPedidos');
    const mensajesAntiguos = this.leerDatosLocales<Mensaje>('backusMensajes');
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [this.pedidosStore, this.mensajesStore],
        'readwrite'
      );
      const pedidos = transaction.objectStore(this.pedidosStore);
      const mensajes = transaction.objectStore(this.mensajesStore);
      const pedidosCount = pedidos.count();
      const mensajesCount = mensajes.count();

      pedidosCount.onsuccess = () => {
        if (pedidosCount.result === 0) {
          pedidosAntiguos.forEach(pedido => pedidos.put(pedido));
        }
      };

      mensajesCount.onsuccess = () => {
        if (mensajesCount.result === 0) {
          mensajesAntiguos.forEach(({ texto, fecha, estado }) => {
            mensajes.add({ texto, fecha, estado });
          });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(
        transaction.error ?? new Error('No se pudieron migrar los datos a IndexedDB.')
      );
    });
  }

  async obtenerPedidos(): Promise<Pedido[]> {
    const db = await this.abrirDB();

    return new Promise((resolve, reject) => {
      const request = db
        .transaction(this.pedidosStore, 'readonly')
        .objectStore(this.pedidosStore)
        .getAll();

      request.onsuccess = () => resolve(request.result as Pedido[]);
      request.onerror = () => reject(request.error);
    });
  }

  async guardarPedido(pedido: Pedido): Promise<void> {
    const db = await this.abrirDB();
    await this.guardarRegistro(db, this.pedidosStore, pedido);
  }

  async eliminarPedido(id: number): Promise<void> {
    const db = await this.abrirDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.pedidosStore, 'readwrite');
      transaction.objectStore(this.pedidosStore).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async guardarMensaje(mensaje: Omit<Mensaje, 'id'>): Promise<void> {
    const db = await this.abrirDB();
    await this.guardarRegistro(db, this.mensajesStore, mensaje);
  }

  private async guardarRegistro(
    db: IDBDatabase,
    storeName: string,
    registro: object
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(registro);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private leerDatosLocales<T>(key: string): T[] {
    const guardados = localStorage.getItem(key);

    if (!guardados) {
      return [];
    }

    const datos: unknown = JSON.parse(guardados);

    if (!Array.isArray(datos)) {
      throw new Error(`Los datos locales de ${key} tienen un formato inválido.`);
    }

    return datos as T[];
  }
}
