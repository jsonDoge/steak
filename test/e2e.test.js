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

describe('Stake E2E', function () {

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

  describe('Staking full period should pass', async function () {
    // Features:
    // - varying APY
    // - adding to stake
    // - claiming rewards midway
    it('Trying to stake for a full year with all features', async function () {
      const newApy1 = 1500; // 15%
      const newApy2 = 600; // 6%
      const stakeAmount = 200 * 10 ** 9;
      const addToStakeAmount = 100 * 10 ** 9;
      const days = 365;

      const balanceBefore = await contracts.stakeToken.balanceOf(staker.address);

      await addStaker(contracts, staker, stakeAmount, days);

      for (let i = 0; i < 6; i++) {
        await network.provider.send('evm_increaseTime', [DAYS_28]);

        await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy1));
      }

      await waitTx(contracts.stake.connect(staker).claimRewards());

      await addToStake(contracts, staker, addToStakeAmount);

      for (let i = 0; i < 8; i++) {
        await network.provider.send('evm_increaseTime', [DAYS_28]);

        await waitTx(contracts.stake.connect(admin).setApy(staker.address, newApy2));
      }

      await waitTx(contracts.stake.connect(staker).claimAll());

      // reward from 1-6 months         '13288594193'
      // reward from 7th month            '895989747'
      // reward from 8-13 months         '8179119028'
      // reward for the last 365th day     '49344949'

      const expectedReward =            '22413047917';

      await expect(
        contracts.stakeToken.balanceOf(staker.address)
      ).to.eventually.equal(balanceBefore.add(expectedReward));
    });
  });
});
