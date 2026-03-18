/**
 * React Query hooks for exchange data.
 */

import { useQuery } from '@tanstack/react-query';
import * as api from '../services/exchangeApi';

export const useOrderBook = (depth = 20) =>
  useQuery({
    queryKey: ['orderBook', depth],
    queryFn: () => api.getOrderBook(depth).then(r => r.data),
    refetchInterval: 2000,
    staleTime: 1500,
  });

export const useMyOrders = (userId, status) =>
  useQuery({
    queryKey: ['myOrders', userId, status],
    queryFn: () => api.getOrders(userId, status).then(r => r.data),
    refetchInterval: 3000,
    staleTime: 2000,
    enabled: !!userId,
  });

export const useMyTrades = (userId, limit = 50) =>
  useQuery({
    queryKey: ['myTrades', userId, limit],
    queryFn: () => api.getTrades(limit, userId).then(r => r.data),
    refetchInterval: 3000,
    staleTime: 2000,
    enabled: !!userId,
  });

export const useAllTrades = (limit = 50) =>
  useQuery({
    queryKey: ['allTrades', limit],
    queryFn: () => api.getTrades(limit).then(r => r.data),
    refetchInterval: 2000,
    staleTime: 1500,
  });

export const useWallet = (userId) =>
  useQuery({
    queryKey: ['wallet', userId],
    queryFn: () => api.getWallet(userId).then(r => r.data),
    refetchInterval: 5000,
    staleTime: 3000,
    enabled: !!userId,
  });

export const useTransactions = (userId) =>
  useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => api.getTransactions(userId).then(r => r.data),
    refetchInterval: 5000,
    staleTime: 3000,
    enabled: !!userId,
  });

export const useTicker = () =>
  useQuery({
    queryKey: ['ticker'],
    queryFn: () => api.getTicker().then(r => r.data),
    refetchInterval: 2000,
    staleTime: 1500,
  });

export const useCryptoStatus = () =>
  useQuery({
    queryKey: ['cryptoStatus'],
    queryFn: () => api.getCryptoStatus().then(r => r.data),
    refetchInterval: 10000,
    staleTime: 8000,
  });
