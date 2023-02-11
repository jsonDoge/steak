const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
// ethers BigNumber does not support floating-point math
const BN = require('bignumber.js');

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
      const days = 21;

      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount, days))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });

    it('Try to stake 0 amount', async function () {
      const stakeAmount = 0;
      const days = 21;

      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount, days))
      ).to.be.rejectedWith('CANT_STAKE_ZERO_AMOUNT');
    });

    it('Try to stake for less than 21 days', async function () {
      const stakeAmount = 1;
      const days = 20;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );

      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount, days))
      ).to.be.rejectedWith('STAKING_DAYS_OUT_OF_BOUNDS');
    });

    it('Try to stake for more than 365 days', async function () {
      const stakeAmount = 1;
      const days = 366;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );

      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount, days))
      ).to.be.rejectedWith('STAKING_DAYS_OUT_OF_BOUNDS');
    });
  });

  describe('Staking should pass', async function () {
    it('Try to stake after setting allowance and 21 days', async function () {
      const stakeAmount = 1;
      const days = 21;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );
      await waitTx(contracts.stake.connect(owner).stake(stakeAmount, days));

      await expect(
        contracts.stake.getTotalStaked(owner.address)
      ).to.eventually.equal(stakeAmount);
    });

    it('Try to stake after setting allowance and 365 days', async function () {
      const stakeAmount = 1;
      const days = 365;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );
      await waitTx(contracts.stake.connect(owner).stake(stakeAmount, days));

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
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      // stake
      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );
      await waitTx(contracts.stake.connect(owner).stake(stakeAmount, days));

      // add apy
      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      // TODO: result is 1999... due to PRB rounding down

      await expect(
        contracts.stake.claimRewards(owner.address, days)
      ).to.eventually.equal((2 * 10 ** 9) - 1);
    });
  });

  describe('Calculates interest rate from APY correctly', async function () {
    it('Getting interest rate of regular', async function () {
      const apy = 1500; // 15%

      const interestRate = await contracts.stake.getInterestRateFromApy(apy);

      const expectedInterestRate = '0.00038298275';
      const resultInterestRate = BN(interestRate.toString())
        .div(BN(10).pow(18)).toString().slice(0, 13);

      expect(resultInterestRate).to.equal(expectedInterestRate);
    });
  });
});
