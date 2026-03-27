/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { User } from "../modules/users/schema";


export const USER_EVENTS = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
} as const;

export const TOURNAMENT_EVENTS = {
  CREATED: 'tournament.created',
  UPDATED: 'tournament.updated',
  COMPLETED: 'tournament.completed',
  PARTICIPANT_ADDED: 'tournament.participant.added',
} as const;

export const RATING_EVENTS = {
  PROCESS_TOURNAMENT: 'rating.process.tournament',
  TOURNAMENT_END: 'rating.tournament.end',
  HISTORY_ADDED: "rating.history.added"
} as const;

type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventBus {
  emit<T>(event: string, payload: T): void;
  on<T>(event: string, handler: EventHandler<T>): () => void;
  once<T>(event: string, handler: EventHandler<T>): void;
}

// In-memory реализация (для начала)
class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  emit<T>(event: string, payload: T): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    // Асинхронный вызов всех подписчиков
    Promise.allSettled(
      Array.from(eventHandlers).map(handler =>
        Promise.resolve(handler(payload))
      )
    ).catch(console.error);
  }

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler as EventHandler);

    // Возвращаем функцию отписки
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  once<T>(event: string, handler: EventHandler<T>): void {
    const onceHandler = (payload: T) => {
      this.off(event, onceHandler);
      return handler(payload);
    };
    this.on(event, onceHandler);
  }

  private off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }
}

// Глобальный инстанс
export const eventBus = new InMemoryEventBus();

// Типизированные события для type-safety
export interface EventPayloads {
  [USER_EVENTS.CREATED]: { userId: string; };
  [USER_EVENTS.UPDATED]: { userId: string; changes: Partial<User> };
  [USER_EVENTS.DELETED]: { userId: string };
  [TOURNAMENT_EVENTS.CREATED]: { tournamentId: number; userId: string; };
  [TOURNAMENT_EVENTS.COMPLETED]: { tournamentId: number; };
  [TOURNAMENT_EVENTS.PARTICIPANT_ADDED]: { tournamentId: number; userId: string; nominationId: number };
  [RATING_EVENTS.PROCESS_TOURNAMENT]: { participantsCount: number; matchesCount: number; tournamentId: number, nominationId: number };
  [RATING_EVENTS.HISTORY_ADDED]: { matchesPlayed: number; userId: string };
  [RATING_EVENTS.TOURNAMENT_END]: { winners: {[nominationId: number]: string[]}, tournamentId: number }
}

// Типизированные хелперы
export function emitEvent<K extends keyof EventPayloads>(
  event: K,
  payload: EventPayloads[K]
): void {
  eventBus.emit(event, payload);
}

export function onEvent<K extends keyof EventPayloads>(
  event: K,
  handler: (payload: EventPayloads[K]) => void | Promise<void>
): () => void {
  return eventBus.on(event, handler);
}