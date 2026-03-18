/**
 * Crypto status API routes.
 */

const express = require('express');
const router = express.Router();
const logger = require('../middleware/logger');
const bitcoinClient = require('../utils/bitcoin-client');
const lightningClient = require('../utils/lightning-client');
const { cryptoSyncHeight } = require('../utils/metrics');

const fs = require('fs');
const inCluster = fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');

// Mock data for Docker Compose mode
const MOCK = {
  bitcoin: {
    blocks: 2847291,
    initialblockdownload: false,
    verificationprogress: 1,
    chain: 'test',
    connections: 8,
  },
  bitcoinNetwork: {
    version: 270000,
    subversion: '/Satoshi:27.0.0/',
    protocolversion: 70016,
  },
  bitcoinBalance: 0.05,
  lightning: {
    identity_pubkey: '03mock_pubkey_for_development_only',
    alias: 'kubelab-lnd',
    num_active_channels: 0,
    num_pending_channels: 0,
    block_height: 2847291,
    synced_to_chain: true,
  },
  lightningBalance: { total_balance: '0', confirmed_balance: '0', unconfirmed_balance: '0' },
  lightningChannels: { channels: [] },
};

async function safeBitcoin(fn) {
  try {
    return await fn();
  } catch (err) {
    logger.warn('Bitcoin RPC call failed', { error: err.message });
    return null;
  }
}

async function safeLightning(fn) {
  try {
    return await fn();
  } catch (err) {
    logger.warn('LND REST call failed', { error: err.message });
    return null;
  }
}

// GET /api/crypto/status
router.get('/status', async (req, res) => {
  if (!inCluster) {
    return res.json({
      success: true,
      mockMode: true,
      bitcoin: { status: 'healthy', blocks: MOCK.bitcoin.blocks },
      lightning: { status: 'healthy', synced: true },
    });
  }

  const [blockchainInfo, lndInfo] = await Promise.all([
    safeBitcoin(() => bitcoinClient.getBlockchainInfo()),
    safeLightning(() => lightningClient.getInfo()),
  ]);

  res.json({
    success: true,
    mockMode: false,
    bitcoin: {
      status: blockchainInfo ? 'healthy' : 'unavailable',
      blocks: blockchainInfo?.blocks,
      ibd: blockchainInfo?.initialblockdownload,
    },
    lightning: {
      status: lndInfo ? 'healthy' : 'unavailable',
      synced: lndInfo?.synced_to_chain,
      alias: lndInfo?.alias,
    },
  });
});

// GET /api/crypto/bitcoin/info
router.get('/bitcoin/info', async (req, res) => {
  if (!inCluster) {
    return res.json({ success: true, mockMode: true, data: MOCK.bitcoin, network: MOCK.bitcoinNetwork });
  }

  const [blockchainInfo, networkInfo] = await Promise.all([
    safeBitcoin(() => bitcoinClient.getBlockchainInfo()),
    safeBitcoin(() => bitcoinClient.getNetworkInfo()),
  ]);

  if (blockchainInfo) {
    cryptoSyncHeight.set({ node: 'bitcoin' }, blockchainInfo.blocks);
  }

  res.json({ success: true, data: blockchainInfo, network: networkInfo });
});

// GET /api/crypto/bitcoin/balance
router.get('/bitcoin/balance', async (req, res) => {
  if (!inCluster) {
    return res.json({ success: true, mockMode: true, balance: MOCK.bitcoinBalance });
  }

  const balance = await safeBitcoin(() => bitcoinClient.getBalance());
  res.json({ success: true, balance });
});

// GET /api/crypto/lightning/info
router.get('/lightning/info', async (req, res) => {
  if (!inCluster) {
    return res.json({
      success: true,
      mockMode: true,
      info: MOCK.lightning,
      balance: MOCK.lightningBalance,
    });
  }

  const [info, balance] = await Promise.all([
    safeLightning(() => lightningClient.getInfo()),
    safeLightning(() => lightningClient.getWalletBalance()),
  ]);

  if (info) {
    cryptoSyncHeight.set({ node: 'lightning' }, info.block_height);
  }

  res.json({ success: true, info, balance });
});

// GET /api/crypto/lightning/channels
router.get('/lightning/channels', async (req, res) => {
  if (!inCluster) {
    return res.json({ success: true, mockMode: true, ...MOCK.lightningChannels });
  }

  const channels = await safeLightning(() => lightningClient.listChannels());
  res.json({ success: true, ...channels });
});

// GET /api/crypto/deposit-address?userId=
router.get('/deposit-address', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query parameter required' });
  }

  if (!inCluster) {
    return res.json({
      success: true,
      mockMode: true,
      address: 'tb1qmockaddressfordevelopmentonlyxxxxxxxxx',
      currency: 'BTC',
    });
  }

  const result = await safeBitcoin(() => bitcoinClient.getNewAddress(userId));
  if (!result) {
    return res.status(503).json({ success: false, error: 'Bitcoin node unavailable' });
  }

  res.json({ success: true, address: result, currency: 'BTC' });
});

module.exports = router;
