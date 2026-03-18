/**
 * Exchange API service — wrappers for all exchange + crypto endpoints.
 */

import api from './api';

// --- Users ---
export const createUser = (username, displayName) =>
  api.post('/exchange/users', { username, displayName });

export const getUser = (id) =>
  api.get(`/exchange/users/${id}`);

// --- Wallet ---
export const getWallet = (userId) =>
  api.get('/exchange/wallet', { params: { userId } });

// --- Orders ---
export const placeOrder = (order) =>
  api.post('/exchange/orders', order);

export const getOrders = (userId, status) =>
  api.get('/exchange/orders', { params: { userId, status } });

export const cancelOrder = (id) =>
  api.delete(`/exchange/orders/${id}`);

// --- Order Book ---
export const getOrderBook = (depth = 20) =>
  api.get('/exchange/orderbook', { params: { depth } });

// --- Trades ---
export const getTrades = (limit = 50, userId) =>
  api.get('/exchange/trades', { params: { limit, userId } });

// --- Ticker ---
export const getTicker = () =>
  api.get('/exchange/ticker');

// --- Deposits / Withdrawals ---
export const recordDeposit = (userId, txHash, amount) =>
  api.post('/exchange/deposits', { userId, txHash, amount });

export const requestWithdrawal = (userId, address, amount) =>
  api.post('/exchange/withdrawals', { userId, address, amount });

// --- Transactions ---
export const getTransactions = (userId) =>
  api.get('/exchange/transactions', { params: { userId } });

// --- Crypto ---
export const getCryptoStatus = () =>
  api.get('/crypto/status');

export const getBitcoinInfo = () =>
  api.get('/crypto/bitcoin/info');

export const getLightningInfo = () =>
  api.get('/crypto/lightning/info');

export const getDepositAddress = (userId) =>
  api.get('/crypto/deposit-address', { params: { userId } });
