/**
 * LND REST API client.
 * HTTP-based, no extra dependencies.
 */

const http = require('http');

const REST_HOST = process.env.LIGHTNING_REST_HOST || 'lightning-0.lightning.kubelab.svc.cluster.local';
const REST_PORT = process.env.LIGHTNING_REST_PORT || '10009';

function restCall(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: REST_HOST,
      port: REST_PORT,
      path,
      method,
      headers: {
        Accept: 'application/json',
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse LND response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('LND REST request timed out'));
    });
    req.end();
  });
}

function restPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: REST_HOST,
      port: REST_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Accept: 'application/json',
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse LND response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('LND REST request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

module.exports = {
  getInfo: () => restCall('/v1/getinfo'),
  getWalletBalance: () => restCall('/v1/balance/blockchain'),
  newAddress: (type = 'p2wkh') => restCall(`/v1/newaddress?type=${type}`),
  sendPayment: (paymentRequest) => restPost('/v1/channels/transactions', { payment_request: paymentRequest }),
  addInvoice: (amtSat, memo = '') => restPost('/v1/invoices', { value: amtSat, memo }),
  listChannels: () => restCall('/v1/channels'),
  listInvoices: () => restCall('/v1/invoices?pending_only=false'),
};
