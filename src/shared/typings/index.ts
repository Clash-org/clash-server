/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const CURRENCY_CODES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "RUB", "CHF", "CAD", "AUD", "INR",
  "BRL", "KRW", "SGD", "NZD", "MXN", "HKD", "NOK", "SEK", "TRY", "ZAR",
  "AED", "PLN", "THB", "IDR", "SAR", "MYR", "DKK", "CZK", "HUF", "ILS"
] as const;

export type CurrencyType = typeof CURRENCY_CODES[number]

export type ParticipantCountType = {[nominationId: number]: number}
export type IsAdditionsType = {[field: string]: boolean}
export type AdditionsInfoType = {[field: string]: any}

export const TournamentStatus = {
  PENDING: 'pending',
  COMPLETED: "completed",
  ACTIVE: 'active'
} as const;
export type TournamentStatusType = typeof TournamentStatus[keyof typeof TournamentStatus];

export const ParticipantStatus = {
  REGISTERED: 'registered',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled'
} as const;
export type ParticipantStatusType = typeof ParticipantStatus[keyof typeof ParticipantStatus];

export const MatchTypes = {
  POOL: 'pool',
  PLAYOFF: 'playoff'
} as const;
export type MatchTypesType = typeof MatchTypes[keyof typeof MatchTypes];

export const TournamentSystem = {
  HYBRID: "hybrid",
  OLYMPIC: "olympic",
  ROBIN: "robin",
  SWISS: "swiss"
} as const
export type TournamentSystemType = typeof TournamentSystem[keyof typeof TournamentSystem];

export type HitZonesType = {
    head: number;
    torso: number;
    arms: number;
    legs: number;
}

export interface SyncConfig {
  rpcUrl: string;
  servicePrivateKey: string;
  userContractAddress: string;
  tournamentContractAddress: string;
  syncInterval: string;
  batchSize: number;
  confirmations: number;
}

export interface Manifest {
  serversIds: number[];
  prices?: number[];
}