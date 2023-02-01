require('@nomiclabs/hardhat-ethers');
require('hardhat-contract-sizer');

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
  },
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};
