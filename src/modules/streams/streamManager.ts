/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StreamInfo, WebSocketMessage } from "../../shared/typings";

interface BroadcasterConnection {
  ws: any; // Bun WebSocket
  streamId: string;
}

interface ViewerConnection {
  ws: any;
  streamId: string;
}

class StreamsManager {
  private streams: Map<string, StreamInfo> = new Map();
  private broadcasterConnections: Map<string, BroadcasterConnection> = new Map();
  private viewerConnections: Map<string, ViewerConnection> = new Map();
  private wsClients: Map<string, any> = new Map();
  private serverInstance: any = null;

  // Установка экземпляра сервера (для publish)
  setServer(server: any) {
    this.serverInstance = server;
  }

  // Регистрация WebSocket клиента
  registerClient(clientId: string, ws: any) {
    this.wsClients.set(clientId, ws);
  }

  // Удаление WebSocket клиента
  unregisterClient(clientId: string) {
    const broadcaster = this.broadcasterConnections.get(clientId);
    if (broadcaster) {
      this.removeStream(broadcaster.streamId, clientId);
    } else {
      const viewer = this.viewerConnections.get(clientId);
      if (viewer) {
        this.removeViewer(clientId);
      }
    }
    this.wsClients.delete(clientId);
  }

  // Создание нового стрима
  createStream(streamId: string, broadcasterId: string, name: string, broadcaster: string, cover: string, betAddress: string, fightId: number, isStreamHidden: boolean, ws: any): StreamInfo {
    const stream: StreamInfo = {
      id: streamId,
      name,
      viewerCount: 0,
      startedAt: new Date().toISOString(),
      broadcaster,
      broadcasterId,
      cover,
      betAddress,
      fightId,
      isStreamHidden,
      isActive: true,
      iceCandidates: [],
    };

    this.streams.set(streamId, stream);
    this.broadcasterConnections.set(broadcasterId, { ws, streamId });

    // Подписываем стримера на stream-specific каналы
    ws.subscribe(`stream:${streamId}:broadcaster`);
    ws.subscribe(`stream:${streamId}:signals`);

    if (!isStreamHidden) {
      const startMessage = JSON.stringify({
        type: 'stream_start',
        payload: stream
      } as WebSocketMessage);

      // Отправляем всем подключённым клиентам
      for (const [_, clientWs] of this.wsClients.entries()) {
        if (clientWs && clientWs.readyState === 1) {
          try {
            clientWs.send(startMessage);
          } catch (e) {}
        }
      }

      // Уведомляем всех об обновлении списка через publish
      this.broadcastStreamList();
    }

    return stream;
  }

  // Удаление стрима
  removeStream(streamId: string, broadcasterId: string) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    this.streams.delete(streamId);
    this.broadcasterConnections.delete(broadcasterId);

    const endMessage = JSON.stringify({
      type: 'stream_end',
      payload: { streamId }
    } as WebSocketMessage);

    // Отправляем всем подключённым клиентам
    for (const [_, clientWs] of this.wsClients.entries()) {
      if (clientWs && clientWs.readyState === 1) {
        try {
          clientWs.send(endMessage);
        } catch (e) {}
      }
    }

    // Отключаем всех зрителей этого стрима через publish
    const message = JSON.stringify({
      type: 'stream_end',
      payload: { streamId, message: 'Broadcaster has ended the stream' }
    } as WebSocketMessage);

    if (this.serverInstance) {
      this.serverInstance.publish(`stream:${streamId}:viewers`, message);
    }

    // Удаляем подключения зрителей
    const viewersToRemove: string[] = [];
    for (const [viewerId, conn] of this.viewerConnections.entries()) {
      if (conn.streamId === streamId) {
        viewersToRemove.push(viewerId);
        try {
          conn.ws.send(message);
          conn.ws.close();
        } catch (e) {}
      }
    }

    viewersToRemove.forEach(id => this.viewerConnections.delete(id));

    // Уведомляем всех об обновлении списка
    this.broadcastStreamList();

    console.log(`📡 Stream ended: ${streamId}`);
  }

  // Добавление зрителя
  addViewer(streamId: string, viewerId: string, ws: any): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.isActive) return false;

    // Проверяем, не подключён ли уже этот зритель
    const existingViewer = this.viewerConnections.get(viewerId);
    if (existingViewer) {
      console.log(`⚠️ Viewer ${viewerId} already connected to stream ${streamId}`);
      // Обновляем WebSocket если нужно
      if (existingViewer.ws !== ws) {
        existingViewer.ws = ws;
      }
      return true;
    }

    this.viewerConnections.set(viewerId, { ws, streamId });
    stream.viewerCount = this.getViewerCount(streamId); // Пересчитываем реальное количество

    console.log(`👤 Viewer ${viewerId} joined stream ${streamId} (total: ${stream.viewerCount})`);

    // Уведомляем стримера
    this.notifyBroadcasterViewerCount(streamId);

    // Уведомляем всех об обновлении списка
    this.broadcastStreamList();

    return true;
  }

  // Удаление зрителя
  removeViewer(viewerId: string) {
    const conn = this.viewerConnections.get(viewerId);
    if (conn) {
      const stream = this.streams.get(conn.streamId);
      if (stream) {
        this.viewerConnections.delete(viewerId);
        stream.viewerCount = this.getViewerCount(stream.streamId);

        console.log(`👋 Viewer ${viewerId} left stream ${stream.streamId} (remaining: ${stream.viewerCount})`);

        // Уведомляем стримера
        this.notifyBroadcasterViewerCount(stream.streamId);
        this.broadcastStreamList();
      }
    }
  }

  // Получение реального количества зрителей
  private getViewerCount(streamId: string): number {
    let count = 0;
    for (const [_, conn] of this.viewerConnections.entries()) {
      if (conn.streamId === streamId && conn.ws.readyState === 1) { // WebSocket.OPEN = 1
        count++;
      }
    }
    return count;
  }

  // Очистка мёртвых соединений
  cleanupDeadConnections() {
    const deadViewers: string[] = [];
    for (const [viewerId, conn] of this.viewerConnections.entries()) {
      if (conn.ws.readyState !== 1) { // Не OPEN
        deadViewers.push(viewerId);
      }
    }

    for (const viewerId of deadViewers) {
      console.log(`🧹 Cleaning up dead viewer connection: ${viewerId}`);
      this.viewerConnections.delete(viewerId);
    }

    // Обновляем количество зрителей для всех стримов
    for (const stream of this.streams.values()) {
      const oldCount = stream.viewerCount;
      stream.viewerCount = this.getViewerCount(stream.id);
      if (oldCount !== stream.viewerCount) {
        this.notifyBroadcasterViewerCount(stream.id);
      }
    }
  }

  // Уведомление стримера о количестве зрителей
  private notifyBroadcasterViewerCount(streamId: string) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    const broadcaster = this.broadcasterConnections.get(stream.broadcasterId);
    if (broadcaster && broadcaster.ws.readyState === 1) {
      broadcaster.ws.send(JSON.stringify({
        type: 'viewer_count_update',
        payload: {
          streamId,
          viewerCount: stream.viewerCount
        }
      } as WebSocketMessage));
    }
  }

  // Удаление дублирующихся зрителей по clientId
  removeDuplicateViewers(clientId: string) {
    // Проверяем, есть ли такой зритель
    const existingViewer = this.viewerConnections.get(clientId);
    if (existingViewer) {
      console.log(`🔄 Removing duplicate viewer: ${clientId}`);
      this.viewerConnections.delete(clientId);
    }
  }

  // Отправка сообщения конкретному клиенту
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const ws = this.wsClients.get(clientId);
    if (ws && ws.readyState === 1) { // OPEN = 1
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Получение информации о стриме
  getStream(streamId: string): StreamInfo | undefined {
    return this.streams.get(streamId);
  }

  // Получение всех активных стримов
  getAllStreams(): StreamInfo[] {
   return Array.from(this.streams.values())
    .filter(s => s.isActive && !s.isStreamHidden)
    .sort((sPrev, sNext) => {
        const datePrev = new Date(sPrev.startedAt).getTime();
        const dateNext = new Date(sNext.startedAt).getTime();
        return dateNext - datePrev;
    });
  }

  getBroadcasterConnection(streamId: string): { ws: any; streamId: string } | null {
    for (const [_, conn] of this.broadcasterConnections.entries()) {
        if (conn.streamId === streamId) {
            return conn;
        }
    }
    return null;
  }

  // Рассылка списка стримов всем подключённым клиентам через publish
  private broadcastStreamList() {
    if (!this.serverInstance) return;

    const streams = this.getAllStreams();
    const message = JSON.stringify({
      type: 'stream_list',
      payload: streams
    } as WebSocketMessage);

    // Публикуем во все каналы стримов
    for (const stream of streams) {
      this.serverInstance.publish(`stream:${stream.id}:broadcaster`, message);
      this.serverInstance.publish(`stream:${stream.id}:viewers`, message);
    }
  }

  // Сохранение ICE кандидата для стрима
  addIceCandidate(streamId: string, candidate: RTCIceCandidateInit) {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.iceCandidates.push(candidate);
    }
  }
}

export const streamsManager = new StreamsManager();