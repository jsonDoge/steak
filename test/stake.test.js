const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { expect } = chai;

const { setupContracts } = require('./helpers/setup');
const { waitTx } = require('./helpers/utils');

let contracts;
let accounts;
let owner;

describe('Stake', function () {

  beforeEach('Setup', async function () {
    accounts = await ethers.getSigners();
    [owner] = accounts;

    contracts = await setupContracts(owner.address);
  });

  describe('Staking should fail', async function () {
    it('Try to stake without setting allowance', async function () {
      const stakeAmount = 1;
      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });

    it('Try to stake 0 amount', async function () {
      const stakeAmount = 0;
      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount))
      ).to.be.rejectedWith('CANT_STAKE_ZERO_AMOUNT');
    });
  });

  describe('Staking should pass', async function () {
    it('Try to stake after setting allowance', async function () {
      const stakeAmount = 1;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );
      await waitTx(contracts.stake.connect(owner).stake(stakeAmount));

      await expect(
        contracts.stake.getTotalStaked(owner.address)
      ).to.eventually.equal(stakeAmount);
    });
  });

  describe('Setting APY should fail', async function () {
    it('Trying to set APY as not admin', async function () {
      const newApy = 1;

      await expect(
        waitTx(contracts.stake.connect(accounts[1]).setApy(owner.address, newApy))
      ).to.be.rejectedWith('ONLY_ADMIN');
    });
  });

  describe('Setting APY should pass', async function () {
    it('Trying to set APY as admin', async function () {
      const newApy = 1;

      await waitTx(contracts.stake.connect(owner).setApy(accounts[1].address, newApy));

      await expect(
        contracts.stake.getApy(accounts[1].address)
      ).to.eventually.equal(newApy);
    });
  });

  describe('Claiming rewards should pass', async function () {
    it('Calculates rewards using staked amount and apy', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200;

      // stake
      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );
      await waitTx(contracts.stake.connect(owner).stake(stakeAmount));

      // add apy
      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await expect(
        contracts.stake.claimRewards(owner.address)
      ).to.eventually.equal(2);
    });
  });
});
