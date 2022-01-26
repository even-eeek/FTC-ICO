require('babel-register');
require('babel-polyfill');
require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

var mnemonic = 'shine drama time sustain black blur safe candy problem hedgehog conduct good';

module.exports = {
  networks: {

    bsc: {
     provider: () => new HDWalletProvider(mnemonic, 'https://bsc-dataseed.binance.org'),
     network_id: 56,
     gas: 6721975,
     gasPrice: 25000000000,
     // confirmations: 10,
     timeoutBlocks: 200,
     skipDryRun: true
   },
   testnet: {
     provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
     network_id: 97,
     gas: 6721975,
     gasPrice: 25000000000,
     // confirmations: 10,
     timeoutBlocks: 200,
     skipDryRun: true
   },
    development: {
      host: 'testnet',
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
          mnemonics,
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
