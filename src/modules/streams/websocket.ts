/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { WebSocketMessage } from '../../shared/typings';
import { streamsManager } from './streamManager';

// Типизация данных, которые будут привязаны к WebSocket
interface WebSocketData {
  clientId: string;
  streamId?: string;
  role?: 'broadcaster' | 'viewer';
  joinedAt: number;
}

// Генерация уникального ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Создание WebSocket обработчика для Bun.serve
export const streamsWebSocket = {
  // Обработчик открытия соединения
  open(ws: any) {
    const clientId = generateClientId();
    // Сохраняем данные прямо на ws (это поддерживается в Bun)
    ws.data = {
      clientId,
      joinedAt: Date.now(),
    };

    streamsManager.registerClient(clientId, ws);

    console.log(`🔌 WebSocket client connected: ${clientId}`);

    // Отправляем приветственное сообщение с clientId
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { clientId }
    } as WebSocketMessage));

    // Отправляем текущий список стримов
    ws.send(JSON.stringify({
      type: 'stream_list',
      payload: streamsManager.getAllStreams()
    } as WebSocketMessage));
  },

  // Обработчик входящих сообщений
  message(ws: any, message: string | Buffer) {
    const clientId = ws.data?.clientId;
    if (!clientId) return;

    try {
      const data = JSON.parse(message.toString()) as WebSocketMessage;
      console.log(`📨 Message from ${clientId}: ${data.type}`,
                  data.streamId ? `for stream ${data.streamId}` : '');

      switch (data.type) {
        case 'register_broadcaster':
          handleRegisterBroadcaster(ws, clientId, data);
          break;

        case 'register_viewer':
          handleRegisterViewer(ws, clientId, data);
          break;

        case 'offer':
          handleOffer(ws, clientId, data);
          break;

        case 'answer':
          handleAnswer(ws, clientId, data);
          break;

        case 'ice_candidate':
          handleIceCandidate(ws, clientId, data);
          break;

        case 'stream_end':
          handleStreamEnd(ws, clientId, data);
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            payload: { message: `Unknown message type: ${data.type}` }
          } as WebSocketMessage));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid message format' }
      } as WebSocketMessage));
    }
  },

  // Обработчик закрытия соединения
  close(ws: any, code: number, reason: string) {
    const clientId = ws.data?.clientId;
    if (clientId) {
      console.log(`🔌 WebSocket client disconnected: ${clientId}, code: ${code}`);
      streamsManager.unregisterClient(clientId);
    }
  },

  // Обработчик ошибок
  error(ws: any, error: Error) {
    console.error(`WebSocket error for client ${ws.data?.clientId}:`, error);
  },

  // Обработчик drain (когда сокет готов получать больше данных)
  drain(ws: any) {
    console.log(`WebSocket drain for client ${ws.data?.clientId}`);
  },
};

// Обработчики команд
function handleStreamEnd(ws: any, clientId: string, data: WebSocketMessage) {
  const { streamId } = data;

  if (!streamId) {
    console.error('❌ stream_end missing streamId');
    return;
  }

  console.log(`📡 Stream end requested for ${streamId} by ${clientId}`);

  // Удаляем стрим из менеджера
  streamsManager.removeStream(streamId, clientId);

  // Уведомляем всех зрителей через publish
  const message = JSON.stringify({
    type: 'stream_end',
    payload: { streamId, message: 'Broadcaster has ended the stream' }
  } as WebSocketMessage);

  // Отправляем всем подписчикам канала этого стрима
  ws.publish(`stream:${streamId}:viewers`, message);
  ws.publish(`stream:${streamId}:broadcaster`, message);
}

function handleRegisterBroadcaster(ws: any, clientId: string, data: WebSocketMessage) {
  const streamId = data.payload?.streamId ||
                   `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const streamName = data.payload?.name || `Broadcast ${new Date().toLocaleTimeString()}`;
  const broadcaster = data.payload?.broadcaster || "Anonymous";
  const cover = data.payload?.cover || "";
  const betAddress = data.payload?.betAddress || "";
  const fightId = data.payload?.fightId || NaN;
  const isStreamHidden = data.payload?.isStreamHidden || false

  const stream = streamsManager.createStream(streamId, clientId, streamName, broadcaster, cover, betAddress, fightId, isStreamHidden, ws);

  // Обновляем данные WebSocket
  ws.data.role = 'broadcaster';
  ws.data.streamId = streamId;

  // Подписываем стримера на его собственную комнату (используем subscribe)
  ws.subscribe(`stream:${streamId}:broadcaster`);
  ws.subscribe(`stream:${streamId}:signals`);

  ws.send(JSON.stringify({
    type: 'broadcast_registered',
    payload: { streamId: stream.id, stream }
  } as WebSocketMessage));

  console.log(`🎥 Broadcast started: ${streamId} by ${clientId}`);
}

function handleRegisterViewer(ws: any, clientId: string, data: WebSocketMessage) {
  const streamId = data.streamId;
  const customViewerId = data.viewerId;
  const viewerId = customViewerId || clientId;
  if (!streamId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Stream ID is required' }
    } as WebSocketMessage));
    return;
  }

  streamsManager.removeDuplicateViewers(viewerId);

  const success = streamsManager.addViewer(streamId, viewerId, ws);

  if (success) {
    ws.data.role = 'viewer';
    ws.data.streamId = streamId;

    // Подписываем зрителя на каналы стрима
    ws.subscribe(`stream:${streamId}:broadcaster`);
    ws.subscribe(`stream:${streamId}:signals`);
    ws.subscribe(`stream:${streamId}:viewers`);

    const stream = streamsManager.getStream(streamId);
    ws.send(JSON.stringify({
      type: 'viewer_registered',
      payload: { streamId, stream }
    } as WebSocketMessage));
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Stream not found or inactive' }
    } as WebSocketMessage));
  }
}

function handleOffer(ws: any, clientId: string, data: WebSocketMessage) {
  const { streamId, payload } = data;

  console.log(`📞 Handling offer from ${clientId}`);
  console.log(`   streamId: ${streamId}`);
  console.log(`   has payload: ${!!payload}`);

  if (!streamId) {
    console.error(`❌ Offer missing streamId`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Stream ID is required' }
    }));
    return;
  }

  if (!payload) {
    console.error(`❌ Offer missing payload for stream ${streamId}`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Offer payload is required' }
    }));
    return;
  }

  // Получаем WebSocket стримера напрямую, а не через publish
  const broadcasterConn = streamsManager.getBroadcasterConnection(streamId);

  if (!broadcasterConn) {
    console.error(`❌ Broadcaster not found for stream ${streamId}`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: `Broadcaster not found for stream ${streamId}` }
    }));
    return;
  }

  // Отправляем offer напрямую стримеру
  broadcasterConn.ws.send(JSON.stringify({
    type: 'offer',
    payload: payload,
    fromId: clientId,
    streamId: streamId
  }));

  console.log(`✅ Offer forwarded to broadcaster for stream ${streamId}`);
}

function handleAnswer(ws: any, clientId: string, data: WebSocketMessage) {
  const { streamId, payload, toId } = data;

  console.log(`📞 Handling answer from ${clientId} to ${toId || 'broadcaster'}`);

  if (!payload) {
    console.error(`❌ Answer missing payload`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Payload is required for answer' }
    }));
    return;
  }

  if (toId) {
    // Отправляем конкретному клиенту
    streamsManager.sendToClient(toId, {
      type: 'answer',
      payload,
      streamId,
      fromId: clientId
    });
  } else if (streamId) {
    // Отправляем стримеру напрямую
    const broadcasterConn = streamsManager.getBroadcasterConnection(streamId);
    if (broadcasterConn) {
      broadcasterConn.ws.send(JSON.stringify({
        type: 'answer',
        payload,
        fromId: clientId,
        streamId
      }));
    } else {
      console.error(`❌ Cannot send answer: broadcaster not found for stream ${streamId}`);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: `Broadcaster not found for stream ${streamId}` }
      }));
    }
  } else {
    console.error(`❌ Answer missing both toId and streamId`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Either toId or streamId is required for answer' }
    }));
  }
}

function handleIceCandidate(ws: any, clientId: string, data: WebSocketMessage) {
  const { streamId, payload, toId } = data;

  console.log(`📞 Handling ICE candidate from ${clientId} for stream ${streamId}`);

  if (!streamId) {
    console.error(`❌ ICE candidate missing streamId`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Stream ID is required' }
    }));
    return;
  }

  if (!payload) {
    console.error(`❌ ICE candidate missing payload for stream ${streamId}`);
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'ICE candidate payload is required' }
    }));
    return;
  }

  // Сохраняем кандидата
  streamsManager.addIceCandidate(streamId, payload);

  if (toId) {
    // Отправляем конкретному клиенту
    streamsManager.sendToClient(toId, {
      type: 'ice_candidate',
      payload,
      fromId: clientId,
      streamId
    });
  } else {
    // Получаем стримера и отправляем напрямую
    const broadcasterConn = streamsManager.getBroadcasterConnection(streamId);
    if (broadcasterConn) {
      broadcasterConn.ws.send(JSON.stringify({
        type: 'ice_candidate',
        payload,
        fromId: clientId,
        streamId
      }));
    } else {
      console.error(`❌ Cannot send ICE candidate: broadcaster not found for stream ${streamId}`);
    }
  }
}