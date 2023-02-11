const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
// ethers BigNumber does not support floating-point math
const BN = require('bignumber.js');
const { network } = require('hardhat');

chai.use(chaiAsPromised);

const { expect } = chai;

const { setupContracts } = require('./helpers/setup');
const { waitTx, addStaker, addToStake } = require('./helpers/utils');

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

    it('Try to stake again while already staking', async function () {
      const stakeAmount = 1;
      const days = 21;

      await waitTx(
        contracts.stakeToken.connect(owner).approve(contracts.stake.address, stakeAmount)
      );

      await waitTx(contracts.stake.connect(owner).stake(stakeAmount, days));

      await expect(
        waitTx(contracts.stake.connect(owner).stake(stakeAmount, days))
      ).to.be.rejectedWith('ALREADY_STAKING');
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

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28 - DAYS_1]);

      await expect(
        waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy))
      ).to.be.rejectedWith('CYCLE_HAS_NOT_ENDED');
    });

    it('Trying to set APY multiple times after 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await expect(
        waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy))
      ).to.be.rejectedWith('CYCLE_HAS_NOT_ENDED');
    });

    it('Trying to set APY after staking has finished', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await expect(
        waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy))
      ).to.be.rejectedWith('STAKING_FINISHED');
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

    it('Trying to set APY for the last cycle', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, accounts[1], stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(accounts[1].address, newApy));

      await expect(
        contracts.stake.getApy(accounts[1].address)
      ).to.eventually.equal(newApy);
    });

    it('Trying to set APY after addToStake called', async function () {
      const newApy = 100;
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;

      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);
      await addToStake(contracts, owner, addToStakeAmount);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      const expectedReward = '152720889';

      await expect(
        contracts.stake.getApy(owner.address)
      ).to.eventually.equal(newApy);
      await expect(
        contracts.stake.getPendingAmount(owner.address)
      ).to.eventually.equal(0);
      await expect(
        contracts.stake.getTotalStaked(owner.address)
      ).to.eventually.equal(BN(stakeAmount).plus(addToStakeAmount).plus(expectedReward));
    });

    it('Trying to set APY second time after addToStake called', async function () {
      const newApy = 100;
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;

      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);
      await addToStake(contracts, owner, addToStakeAmount);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      const expectedRewardFirstCycle =  '152720889';
      const expectedRewardSecondCycle = '229197953';

      await expect(
        contracts.stake.getApy(owner.address)
      ).to.eventually.equal(newApy);
      await expect(
        contracts.stake.getPendingAmount(owner.address)
      ).to.eventually.equal(0);
      await expect(
        contracts.stake.getTotalStaked(owner.address)
      ).to.eventually.equal(
        BN(stakeAmount)
          .plus(addToStakeAmount)
          .plus(expectedRewardFirstCycle)
          .plus(expectedRewardSecondCycle)
      );
    });
  });

  describe('Claiming rewards should fail', async function () {
    it('Claiming rewards twice', async function () {
      const newApy = 100;
      const stakeAmount = 10000;
      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await waitTx(contracts.stake.connect(owner).claimRewards());

      await expect(
        waitTx(contracts.stake.connect(owner).claimRewards())
      ).to.be.rejectedWith('CLAIMABLE_AMOUNT_IS_ZERO');
    });
  });

  describe('Claiming rewards should pass', async function () {
    it('Claiming full cycle rewards (28 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      const balanceBefore = await contracts.stakeToken.balanceOf(owner.address);
      await waitTx(contracts.stake.connect(owner).claimRewards());

      const expectedReward = '152720889';

      await expect(
        contracts.stakeToken.balanceOf(owner.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });

    it('Claiming partial cycle rewards (21 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 21;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      const balanceBefore = await contracts.stakeToken.balanceOf(owner.address);
      await waitTx(contracts.stake.connect(owner).claimRewards());

      const expectedReward = '114529737';

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

  describe('Claiming all should fail', async function () {
    it('Claiming all while still locked', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28 - DAYS_1]);

      await expect(
        waitTx(contracts.stake.connect(owner).claimAll())
      ).to.be.rejectedWith('LOCKED');
    });

    it('Claiming all before final APY submission', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await expect(
        waitTx(contracts.stake.connect(owner).claimAll())
      ).to.be.rejectedWith('FINAL_APY_NOT_APPLIED');
    });
  });

  describe('Claiming all should pass', async function () {
    it('Claiming all partial cycle (21 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 21;

      const balanceBefore = await contracts.stakeToken.balanceOf(owner.address);

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));
      await waitTx(contracts.stake.connect(owner).claimAll());

      const expectedReward = '114529737';

      await expect(
        contracts.stakeToken.balanceOf(owner.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });

    it('Claiming all full cycle (28 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      const balanceBefore = await contracts.stakeToken.balanceOf(owner.address);

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));
      await waitTx(contracts.stake.connect(owner).claimAll());

      const expectedReward = '152720889';

      await expect(
        contracts.stakeToken.balanceOf(owner.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });
  });

  describe('Adding to stake should fail', async function () {
    it('Trying to add to stake while not staking', async function () {
      const stakeAmount = 1;

      await expect(
        waitTx(contracts.stake.connect(owner).addToStake(stakeAmount))
      ).to.be.rejectedWith('STAKED_AMOUNT_IS_ZERO');
    });

    it('Trying to add to stake in final cycle', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 29;

      await addStaker(contracts, owner, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(owner).setApy(owner.address, newApy));

      await expect(
        waitTx(contracts.stake.connect(owner).addToStake(stakeAmount))
      ).to.be.rejectedWith('FINAL_CYCLE');
    });

    it('Trying to add to stake without allowance', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);

      await expect(
        waitTx(contracts.stake.connect(owner).addToStake(stakeAmount))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });
  });

  describe('Adding to stake should pass', async function () {
    it('Trying to add to stake in the first cycle', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, owner, stakeAmount, days);

      await addToStake(contracts, owner, addToStakeAmount);

      await expect(
        contracts.stake.getPendingAmount(owner.address)
      ).to.eventually.equal(addToStakeAmount);
    });
  });
});
