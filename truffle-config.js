require('babel-register');
require('babel-polyfill');
require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      gas: 6721975,
      gasPrice: 25000000000,
      network_id: '*',
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      gas: 6721975,
      gasPrice: 25000000000,
      network_id: '*',
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          `https://ropsten.infura.io/${process.env.INFURA_API_KEY}`
        )
      },
      gas: 5000000,
      gasPrice: 25000000000,
      network_id: 3
    }
  },
  compilers: {
    solc: {
      version: "^0.8.0",
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter'
  },
  plugins: ["solidity-coverage"],
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
