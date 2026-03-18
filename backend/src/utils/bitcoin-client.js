/**
 * Bitcoin Core JSON-RPC client.
 * HTTP-based, no extra dependencies.
 */

const http = require('http');

const RPC_HOST = process.env.BITCOIN_RPC_HOST || 'bitcoin-0.bitcoin.kubelab.svc.cluster.local';
const RPC_PORT = process.env.BITCOIN_RPC_PORT || '18332';
const RPC_USER = process.env.BITCOIN_RPC_USER || '';
const RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD || '';

function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '1.0',
      id: 'kubelab',
      method,
      params,
    });

    const options = {
      hostname: RPC_HOST,
      port: RPC_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: 'Basic ' + Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString('base64'),
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed.result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse RPC response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Bitcoin RPC request timed out'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  getBlockchainInfo: () => rpcCall('getblockchaininfo'),
  getBalance: () => rpcCall('getbalance'),
  getNewAddress: (label = 'kubelab') => rpcCall('getnewaddress', [label]),
  sendToAddress: (address, amount) => rpcCall('sendtoaddress', [address, amount]),
  listTransactions: (count = 10) => rpcCall('listtransactions', ['*', count]),
  getNetworkInfo: () => rpcCall('getnetworkinfo'),
};
