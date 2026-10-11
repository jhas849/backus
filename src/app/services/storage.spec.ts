import { Injectable } from '@angular/core';
@Injectable({
 providedIn: 'root'
})
export class StorageService {
 private dbName = 'backusVentasDB';
 private storeName = 'pedidos';
 async abrirDB(): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
 const request = indexedDB.open(this.dbName, 1);
 request.onupgradeneeded = () => {
 const db = request.result;
 if (!db.objectStoreNames.contains(this.storeName)) {
 db.createObjectStore(this.storeName, {
 keyPath: 'id',
 autoIncrement: true
 });
 }
 };
 request.onsuccess = () => {
 resolve(request.result);
 };
 request.onerror = () => {
 reject(request.error);
 };
 });
 }
 async guardarPedido(pedido: any): Promise<void> {
 const db = await this.abrirDB();
 return new Promise((resolve, reject) => {
 const transaction =
 db.transaction(this.storeName, 'readwrite');
 const store =
 transaction.objectStore(this.storeName);
 store.add({
 ...pedido,
 fecha: new Date().toISOString(),
 estado: 'pendiente'
 });
 transaction.oncomplete = () => {
 resolve();
 };
 transaction.onerror = () => {
 reject(transaction.error);
 };
 });
 }
}