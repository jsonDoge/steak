const { expect } = require('chai');

const { setupContracts } = require('./helpers/setup');

let contracts;
let account;

describe('App helper functions', function () {

  beforeEach('setup', async function () {
    const accounts = await ethers.getSigners();
    [account] = accounts;

    contracts = await setupContracts(account.address);
  });

  describe('Sanity test', async function () {
    it('Sanity test', async function () {
      expect(1).to.eq(1);
    });
  });
});
