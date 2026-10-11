
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Pedido, StorageService } from './services/storage';

interface Producto {
  id: number;
  producto: string;
  categoria: string;
  precio: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {

  constructor(private storage: StorageService) {}

  online = navigator.onLine;
  serviceWorkerActivo = false;
  mensaje = '';
  aviso = '';

  productos: Producto[] = [
    {
      id: 1,
      producto: 'Cristal 620 ml',
      categoria: 'Cerveza',
      precio: 7.50
    },
    {
      id: 2,
      producto: 'Pilsen Callao 620 ml',
      categoria: 'Cerveza',
      precio: 8.00
    },
    {
      id: 3,
      producto: 'Cusqueña 620 ml',
      categoria: 'Cerveza',
      precio: 9.00
    }
  ];

  pedidos: Pedido[] = [];

  private alConectar = (): void => {
    this.online = true;
  };

  private alDesconectar = (): void => {
    this.online = false;
  };

  ngOnInit(): void {
    window.addEventListener('online', this.alConectar);
    window.addEventListener('offline', this.alDesconectar);

    void this.cargarPedidos();
    this.comprobarServiceWorker();
    this.cargarCatalogo();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.alConectar);
    window.removeEventListener('offline', this.alDesconectar);
  }

  async cargarPedidos(): Promise<void> {
    try {
      await this.storage.migrarDatosLocales();
      const guardados = await this.storage.obtenerPedidos();

      this.pedidos = guardados.map((pedido, indice) => ({
        ...pedido,
        id: pedido.id ?? indice + 1,
        fecha: pedido.fecha
          ? new Date(pedido.fecha).toLocaleString('es-PE')
          : 'Fecha no disponible',
        estado: pedido.estado || 'Pendiente'
      }));
    } catch {
      this.aviso = 'No se pudieron cargar los pedidos desde IndexedDB.';
    }
  }

  async comprobarServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.serviceWorkerActivo = false;
      return;
    }

    try {
      const registro = await navigator.serviceWorker.getRegistration();
      this.serviceWorkerActivo = !!registro?.active;
    } catch {
      this.serviceWorkerActivo = false;
    }
  }

  async cargarCatalogo(): Promise<void> {
    try {
      const respuesta = await fetch('/data/catalogo.json');

      if (!respuesta.ok) {
        return;
      }

      const datos: Producto[] = await respuesta.json();

      if (Array.isArray(datos)) {
        this.productos = datos;
      }
    } catch {
      this.aviso =
        'No se pudo actualizar el catálogo. Se muestran los productos disponibles.';
    }
  }

  async guardarMensaje(): Promise<void> {
    if (!this.mensaje.trim()) {
      this.aviso = 'Escribe un mensaje antes de guardar.';
      return;
    }

    try {
      await this.storage.guardarMensaje({
        texto: this.mensaje.trim(),
        fecha: new Date().toISOString(),
        estado: this.online ? 'Por procesar' : 'Pendiente'
      });

      this.aviso = this.online
        ? 'Mensaje guardado correctamente en el dispositivo.'
        : 'Sin conexión: mensaje guardado en este dispositivo.';

      this.mensaje = '';
    } catch {
      this.aviso = 'No se pudo guardar el mensaje.';
    }
  }

  async registrarPedido(producto: Producto): Promise<void> {
    const pedido: Pedido = {
      id: Date.now(),
      producto: producto.producto,
      precio: producto.precio,
      fecha: new Date().toISOString(),
      estado: 'Pendiente'
    };

    try {
      await this.storage.guardarPedido(pedido);

      this.pedidos.unshift({
        ...pedido,
        fecha: new Date(pedido.fecha).toLocaleString('es-PE')
      });

      this.aviso =
        `Pedido de ${producto.producto} registrado correctamente.`;
    } catch {
      this.aviso = 'No se pudo guardar el pedido.';
    }
  }

  async eliminarPedido(id: number): Promise<void> {
    const anteriores = this.pedidos;

    try {
      await this.storage.eliminarPedido(id);
      this.pedidos = this.pedidos.filter(pedido => pedido.id !== id);

      this.aviso = 'Pedido eliminado correctamente.';
    } catch {
      this.pedidos = anteriores;
      this.aviso = 'No se pudo eliminar el pedido.';
    }
  }
}
