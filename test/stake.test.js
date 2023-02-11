const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
// ethers BigNumber does not support floating-point math
const BN = require('bignumber.js');
const { network } = require('hardhat');

chai.use(chaiAsPromised);

const { expect } = chai;

const { setupContracts } = require('./helpers/setup');
const { waitTx, addStaker } = require('./helpers/utils');

const DAYS_1 = 60 * 60 * 24 * 1;
const DAYS_28 = DAYS_1 * 28;

let contracts;
let accounts;
let owner;

describe('Stake', function () {

  beforeEach('Setup', async function () {
    accounts = await ethers.getSigners();
    [owner] = accounts;

    contracts = await setupContracts(owner.address);

    // fund staking contract
    await contracts.stakeToken.connect(owner).transfer(
      contracts.stake.address,
      BN(100).times(BN(10).pow(18)).toFixed()
    );

    await contracts.stakeToken.connect(owner).transfer(
      accounts[1].address,
      BN(100).times(BN(10).pow(18)).toFixed()
    );
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

    it('Trying to set APY before 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      // stake
      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28 - 1]);

      await expect(
        waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy))
      ).to.be.rejectedWith('CYCLE_HAS_NOT_ENDED');
    });
  });

  describe('Setting APY should pass', async function () {
    it('Trying to set APY as admin after 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, accounts[1], stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(accounts[1].address, newApy));

      await expect(
        contracts.stake.getApy(accounts[1].address)
      ).to.eventually.equal(newApy);
    });
  });

  describe('Claiming rewards should pass', async function () {
    it('Claiming after 28 days passed', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      // stake
      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      // add apy
      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      const balanceBefore = await contracts.stakeToken.balanceOf(owner.address);
      await waitTx(contracts.stake.connect(owner).claimRewards());

      const expectedReward = '152720889';

      await expect(
        contracts.stakeToken.balanceOf(owner.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
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
