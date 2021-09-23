require('babel-register');
require('babel-polyfill');
require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 4712388,
      gasPrice: 1000000000,
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 4712388,
      gasPrice: 1000000000,
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          `https://ropsten.infura.io/${process.env.INFURA_API_KEY}`
        )
      },
      gas: 4712388,
      gasPrice: 100000000,
      network_id: 3
    }
  },
  compilers: {
    solc: {
      version: "^0.8.0",
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
