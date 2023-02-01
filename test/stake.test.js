const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { expect } = chai;

const { setupContracts } = require('./helpers/setup');
const { waitTx } = require('./helpers/utils');

let contracts;
let account;

describe('Stake', function () {

  beforeEach('Setup', async function () {
    const accounts = await ethers.getSigners();
    [account] = accounts;

    contracts = await setupContracts(account.address);
  });

  describe('Staking should fail', async function () {
    it('Try to stake without setting allowance', async function () {
      const stakeAmount = 1;
      await expect(
        waitTx(contracts.stake.connect(account).stake(stakeAmount))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });

    it('Try to stake 0 amount', async function () {
      const stakeAmount = 0;
      await expect(
        waitTx(contracts.stake.connect(account).stake(stakeAmount))
      ).to.be.rejectedWith('CANT_STAKE_ZERO_AMOUNT');
    });
  });
});
