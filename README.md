# 🥩Steak staking contracts

Contracts
- Stake.sol - staking
- ERC20PresetFixedSupply.sol - staking token contract (source: [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts))

Using [PRBMath](https://www.npmjs.com/package/@prb/math) for more complex math in compound calculations.

## Test

Using hardhat with chai library to test contracts.

Run commands:

`yarn install`

`yarn test`

To run only E2E tests:

`yarn test:e2e`

## Functions

### Public

-admin-

- `setApy(address staker, uint256 newApy)` - can be called only by admin (deployer). Used to set the new APY for stakers. Can only be called after each cycle of 28 days ends. During this function call all the interest/claimable and staked amount calculations occur.

-staker-

- `stake(uint256 amount, uint256 days_)` - used for staking. The staker has to provide the initial amount (0 < x < 1e58) and desired amount of days (21 <= x <= 365).

- `addToStake(uint256 amount)` - used for adding to already staked amount. The staker can add as much as he wants (0 < x < 1e58) as many times as he wants as long as the current cycle is not the last one. This restriction is added as there is no reason to add to stake since the extra interest from the extra amount will not be applied by the end of staking.

- `getTotalStaked(address staker)` - returns stakers total amount used for interest calculation (staked + claimable).

- `getPendingAmount(address staker)` - returns stakers pending amount. Amount added using AddToStake and does not yet yield interest.

- `getApy(address staker)` - returns the last APY set by setApy. While in the first cycle this will be 0.

- `claimRewards()` - sends all **claimable** rewards to the caller if his claimableAmount is above 0.

- `claimAll()` - sends **staked amount and all claimable rewards** to the caller if the staking has finished.

### Private

-math-

- `getInterestRateFromApy(uint256 apy)` - returns provided APYs compound interest rate of **1 day**.

- `getRewards(uint256 s, uint256 apy, uint256 days_)` - returns interest reward amount from provided arguments.
  - s - initial staked amount
  - apy - annual percentage yield
  - days - duration in days staked

-helpers-

- `_now()` - timestamp in seconds.

- `_getStakeStartdate(uint256 lockedUntil, uint256 durationDays)` - calculates stake start date in seconds from provided staker arguments.

- `_getFinalCycle(uint256 days_)` - returns the cycle number for which the admin **DOES NO NEED** to provide APY (setApy) and the staking has finished.


### State variables and types

- All state variables are private (developer preference) and only disclosed in explicit public functions:
  - admin - address of the deployer
  - stakeToken - address of the staking token (ERC20)
  - stakers - a mapping of staker addresses to a Staker struct
- Staker struct is composed of:
<pre>
  uint256 stakedAmount;     [locked actively staking amount]
  uint256 claimableAmount;  [immediately claimable amount from staking]
  uint256 pendingAmount;    [locked amount added using addToStake and is pending addition to stakedAmount at the beginning of the next cycle]
  uint256 lockedUntil;      [date in <b>seconds</b> when staking will finish]
  uint256 durationDays;     [staking duration in <b>days</b> set by the staker at the beginning]
  uint256 apy;              [stored as 0.01% units. <b>1 = 0.01%</b>]
  uint8 currentCycle;       [stakers cycle counter starts at 1]
</pre>

## NOTES

- @prb/math package used for math performs rounding down in all their math operations. This can cause results with exact values like 100000000... become 99999.... The values lost are very insignificant, but are visually unpleasant. This guarantees that the staker does not receive more than he should. Otherwise, we could try applying round up manually, but this would of course, require more gas.

- setApy function can be called at any time after each cycle. Even if multiple cycle duration has passed (for example 56 days) the admin can immediately set both APYs for the first and second cycles. WARNING: This means that the staker will not be able to claim rewards until the setApy is called.

- Staking Contract has to be manually supplied funds for staking rewards. Currently, there is no function to withdraw them.

- Staker cannot stake a larger amount than 1e58 due to @prb/math supporting numbers up to 59/60 integer digits.

## TODO

This section is dedicated to what I would work to improve further.

- Investigate @prb/math further to see how to avoid minor discrepancies or look for a more accurate alternative.

- Improve interest formula to use fewer math functions to achieve the same result.

- Add events to be able to track staking progress off-chain.

- Look into refactoring the current setApy logic to avoid multiple getRewards calculations and do it in one function when staker is claiming. It should provide better accuracy.

- Look for a way to test private methods so that all tests would always be running.
