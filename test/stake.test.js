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
let admin;
let staker;

describe('Stake', function () {

  beforeEach('Setup', async function () {
    accounts = await ethers.getSigners();
    [admin, staker] = accounts;

    contracts = await setupContracts(admin.address);

    // fund staking contract
    await contracts.stakeToken.connect(admin).transfer(
      contracts.stake.address,
      BN(100).times(BN(10).pow(18)).toFixed()
    );

    // fund staker
    await contracts.stakeToken.connect(admin).transfer(
      staker.address,
      BN(400).times(BN(10).pow(18)).toFixed()
    );
  });

  describe('Staking should fail', async function () {
    it('Try to stake without setting allowance', async function () {
      const stakeAmount = 1;
      const days = 21;

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount, days))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });

    it('Try to stake 0 amount', async function () {
      const stakeAmount = 0;
      const days = 21;

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount, days))
      ).to.be.rejectedWith('CANT_STAKE_ZERO_AMOUNT');
    });

    it('Try to stake for less than 21 days', async function () {
      const stakeAmount = 1;
      const days = 20;

      await waitTx(
        contracts.stakeToken.connect(staker).approve(contracts.stake.address, stakeAmount)
      );

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount, days))
      ).to.be.rejectedWith('STAKING_DAYS_OUT_OF_BOUNDS');
    });

    it('Try to stake for more than 365 days', async function () {
      const stakeAmount = 1;
      const days = 366;

      await waitTx(
        contracts.stakeToken.connect(staker).approve(contracts.stake.address, stakeAmount)
      );

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount, days))
      ).to.be.rejectedWith('STAKING_DAYS_OUT_OF_BOUNDS');
    });

    it('Try to stake above max amount', async function () {
      const stakeAmount = BN(1e58);
      const days = 365;

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount.toFixed(), days))
      ).to.be.rejectedWith('AMOUNT_MAX_LIMIT');
    });

    it('Try to stake again while already staking', async function () {
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, staker, stakeAmount, days);

      await expect(
        waitTx(contracts.stake.connect(staker).stake(stakeAmount, days))
      ).to.be.rejectedWith('ALREADY_STAKING');
    });
  });

  describe('Staking should pass', async function () {
    it('Try to stake after setting allowance and 21 days', async function () {
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, staker, stakeAmount, days);

      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(stakeAmount);
    });

    it('Try to stake after setting allowance and 365 days', async function () {
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(stakeAmount);
    });

    it('Two stakers at the same time', async function () {
      const stakeAmount = 1;
      const days = 365;

      // fund another staker
      await contracts.stakeToken.connect(admin).transfer(
        accounts[2].address,
        BN(1).times(BN(10).pow(18)).toFixed()
      );

      await addStaker(contracts, staker, stakeAmount, days);
      await addStaker(contracts, accounts[2], stakeAmount + 1, days);

      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(stakeAmount);

      await expect(
        contracts.stake.getTotalStaked(accounts[2].address)
      ).to.eventually.equal(stakeAmount + 1);
    });
  });

  describe('Setting APY should fail', async function () {
    it('Trying to set APY as not admin', async function () {
      const newApy = 1;

      await expect(
        waitTx(contracts.stake.connect(staker).setApy(admin.address, newApy))
      ).to.be.rejectedWith('ONLY_ADMIN');
    });

    it('Trying to set APY to more than 100%', async function () {
      const newApy = 10001; // 100.01%
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await expect(
        waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy))
      ).to.be.rejectedWith('APY_TOO_BIG');
    });


    it('Trying to set APY before 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28 - DAYS_1]);

      await expect(
        waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy))
      ).to.be.rejectedWith('CYCLE_HAS_NOT_ENDED');
    });

    it('Trying to set APY multiple times after 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await expect(
        waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy))
      ).to.be.rejectedWith('CYCLE_HAS_NOT_ENDED');
    });

    it('Trying to set APY after staking has finished', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await expect(
        waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy))
      ).to.be.rejectedWith('STAKING_FINISHED');
    });
  });

  describe('Setting APY should pass', async function () {
    it('Trying to set APY as admin after 28 days passed', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await expect(
        contracts.stake.getApy(staker.address)
      ).to.eventually.equal(newApy);
    });

    it('Trying to set APY for the last cycle', async function () {
      const newApy = 1;
      const stakeAmount = 1;
      const days = 21;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await expect(
        contracts.stake.getApy(staker.address)
      ).to.eventually.equal(newApy);
    });

    it('Trying to set APY after addToStake called', async function () {
      const newApy = 100;
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;

      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);
      await addToStake(contracts, staker, addToStakeAmount);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      const expectedReward = '152720889';

      await expect(
        contracts.stake.getApy(staker.address)
      ).to.eventually.equal(newApy);
      await expect(
        contracts.stake.getPendingAmount(staker.address)
      ).to.eventually.equal(0);
      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(BN(stakeAmount).plus(addToStakeAmount).plus(expectedReward));
    });

    it('Trying to set APY second time after addToStake called', async function () {
      const newApy = 100;
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;

      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);
      await addToStake(contracts, staker, addToStakeAmount);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      const expectedRewardFirstCycle =  '152720889';
      const expectedRewardSecondCycle = '229197953';

      await expect(
        contracts.stake.getApy(staker.address)
      ).to.eventually.equal(newApy);
      await expect(
        contracts.stake.getPendingAmount(staker.address)
      ).to.eventually.equal(0);
      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(
        BN(stakeAmount)
          .plus(addToStakeAmount)
          .plus(expectedRewardFirstCycle)
          .plus(expectedRewardSecondCycle)
      );
    });

    it('Trying to set APY for the both cycles after two cycles passed', async function () {
      const newApy1 = 100; // 1%
      const newApy2 = 200; // 2%
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);
      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy1));
      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy2));

      const expectedReward = '457005080';

      await expect(
        contracts.stake.getApy(staker.address)
      ).to.eventually.equal(newApy2);
      await expect(
        contracts.stake.getTotalStaked(staker.address)
      ).to.eventually.equal(BN(stakeAmount).plus(expectedReward));
    });
  });

  describe('Claiming rewards should fail', async function () {
    it('Claiming rewards twice', async function () {
      const newApy = 100;
      const stakeAmount = 10000;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await waitTx(contracts.stake.connect(staker).claimRewards());

      await expect(
        waitTx(contracts.stake.connect(staker).claimRewards())
      ).to.be.rejectedWith('CLAIMABLE_AMOUNT_IS_ZERO');
    });
  });

  describe('Claiming rewards should pass', async function () {
    it('Claiming full cycle rewards (28 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      const balanceBefore = await contracts.stakeToken.balanceOf(staker.address);
      await waitTx(contracts.stake.connect(staker).claimRewards());

      const expectedReward = '152720889';

      await expect(
        contracts.stakeToken.balanceOf(staker.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });

    it('Claiming partial cycle rewards (21 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 21;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      const balanceBefore = await contracts.stakeToken.balanceOf(staker.address);
      await waitTx(contracts.stake.connect(staker).claimRewards());

      const expectedReward = '114529737';

      await expect(
        contracts.stakeToken.balanceOf(staker.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });
  });

  // This is manually tested by setting getInterestRateFromApy to a public function
  describe.skip('Calculates interest rate from APY correctly [private]', async function () {
    it('Getting interest rate of 15% apy', async function () {
      const apy = 1500; // 15%

      const interestRate = await contracts.stake.getInterestRateFromApy(apy);

      const expectedInterestRate = '0.0003829827503389';

      // prb-math last 2 decimal values are not accurate
      const resultInterestRate = BN(interestRate.toString())
        .div(BN(10).pow(18)).toString().slice(0, 18);

      expect(resultInterestRate).to.equal(expectedInterestRate);
    });

    it('Getting interest rate of 0% apy', async function () {
      const apy = 0;

      const interestRate = await contracts.stake.getInterestRateFromApy(apy);

      const expectedInterestRate = '0';
      const resultInterestRate = BN(interestRate.toString())
        .div(BN(10).pow(18)).toString();

      expect(resultInterestRate).to.equal(expectedInterestRate);
    });
  });

  // This is manually tested by setting getRewards to a public function
  describe.skip('Calculates rewards correctly [private]', async function () {
    it('Getting rewards of a staked amount', async function () {
      const apy = 1500; // 15%
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      const rewards = await contracts.stake.getRewards(stakeAmount, apy, days);
      const expectedRewards = '2155828985';

      expect(rewards).to.equal(expectedRewards);
    });

    it('Getting rewards of a staked amount and 0% apy', async function () {
      const apy = 0;
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      const rewards = await contracts.stake.getRewards(stakeAmount, apy, days);
      const expectedRewards = '0';

      expect(rewards).to.equal(expectedRewards);
    });
  });

  describe('Claiming all should fail', async function () {
    it('Claiming all while still locked', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28 - DAYS_1]);

      await expect(
        waitTx(contracts.stake.connect(staker).claimAll())
      ).to.be.rejectedWith('LOCKED');
    });

    it('Claiming all before final APY submission', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await expect(
        waitTx(contracts.stake.connect(staker).claimAll())
      ).to.be.rejectedWith('FINAL_APY_NOT_APPLIED');
    });
  });

  describe('Claiming all should pass', async function () {
    it('Claiming all partial cycle (21 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 21;

      const balanceBefore = await contracts.stakeToken.balanceOf(staker.address);

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));
      await waitTx(contracts.stake.connect(staker).claimAll());

      const expectedReward = '114529737';

      await expect(
        contracts.stakeToken.balanceOf(staker.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });

    it('Claiming all full cycle (28 days)', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 28;

      const balanceBefore = await contracts.stakeToken.balanceOf(staker.address);

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));
      await waitTx(contracts.stake.connect(staker).claimAll());

      const expectedReward = '152720889';

      await expect(
        contracts.stakeToken.balanceOf(staker.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });
  });

  describe('Adding to stake should fail', async function () {
    it('Trying to add to stake while not staking', async function () {
      const stakeAmount = 1;

      await expect(
        waitTx(contracts.stake.connect(staker).addToStake(stakeAmount))
      ).to.be.rejectedWith('STAKED_AMOUNT_IS_ZERO');
    });

    it('Trying to add to stake in final cycle', async function () {
      const newApy = 100; // 1%
      const stakeAmount = 200 * 10 ** 9;
      const days = 29;

      await addStaker(contracts, staker, stakeAmount, days);

      await network.provider.send('evm_increaseTime', [DAYS_28]);

      await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy));

      await expect(
        waitTx(contracts.stake.connect(staker).addToStake(stakeAmount))
      ).to.be.rejectedWith('FINAL_CYCLE');
    });

    it('Trying to add to stake without allowance', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await expect(
        waitTx(contracts.stake.connect(staker).addToStake(stakeAmount))
      ).to.be.rejectedWith('NOT_ENOUGH_ALLOWANCE');
    });

    it('Trying to add to stake above max amount', async function () {
      const stakeAmount = 1;
      const addToStakeAmount = BN(1e58).minus(1);
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await expect(
        waitTx(contracts.stake.connect(staker).addToStake(addToStakeAmount.toFixed()))
      ).to.be.rejectedWith('AMOUNT_MAX_LIMIT');
    });
  });

  describe('Adding to stake should pass', async function () {
    it('Trying to add to stake in the first cycle', async function () {
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;
      const days = 365;

      await addStaker(contracts, staker, stakeAmount, days);

      await addToStake(contracts, staker, addToStakeAmount);

      await expect(
        contracts.stake.getPendingAmount(staker.address)
      ).to.eventually.equal(addToStakeAmount);
    });
  });
});
