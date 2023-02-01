const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

const { expect } = chai;

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
      await expect(
        waitTx(contracts.stake.connect(account).stake(stakeAmount))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });
  });
});
