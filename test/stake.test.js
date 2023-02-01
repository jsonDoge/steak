const { expect } = require('chai');

const { setupContracts } = require('./helpers/setup');
const { waitTx } = require('./helpers/utils');

let contracts;
let account;

describe('App helper functions', function () {

  beforeEach('setup', async function () {
    const accounts = await ethers.getSigners();
    [account] = accounts;

    contracts = await setupContracts(account.address);
  });

  describe('Staking', async function () {
    it('Try to stake without setting allowance', async function () {
      const stakeAmount = 1;
      try {
        await waitTx(contracts.stake.connect(account).stake(stakeAmount));
      } catch (e) {
        expect(e.toString()).to.contain('NOT_ENOUGH_ALLOWANCE');
      }
    });
  });
});
