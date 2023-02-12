// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@prb/math/src/UD60x18.sol" as PRB;

contract Stake {
    address private admin;
    address private stakeToken;

    struct Staker {
        uint256 stakedAmount;
        uint256 claimableAmount;
        uint256 pendingAmount;
        uint256 lockedUntil;
        uint256 durationDays;
        // is stored as 0.01% units
        uint256 apy;
        uint8 currentCycle;
    }

    mapping(address => Staker) private stakers;

    constructor(address admin_, address stakeToken_) {
        admin = admin_;
        stakeToken = stakeToken_;
    }

    modifier onlyAdmin() {
        require(admin == msg.sender, "ONLY_ADMIN");
        _;
    }

    // admin

    function setApy(address staker, uint256 newApy) public onlyAdmin {
        require(stakers[staker].stakedAmount > 0, "STAKER_NOT_FOUND");
        require(
            stakers[staker].currentCycle != _getFinalCycle(stakers[staker].durationDays),
            "STAKING_FINISHED"
        );
        require(
            _now() -
                _getStakeStartdate(stakers[staker].lockedUntil, stakers[staker].durationDays) >=
                uint256(stakers[staker].currentCycle) * 28 days,
            "CYCLE_HAS_NOT_ENDED"
        );

        stakers[staker].apy = newApy;

        uint256 cycleDays = 28;
        if (stakers[staker].lockedUntil <= _now()) {
            // last cycle
            cycleDays = stakers[staker].durationDays % 28 != 0
                ? stakers[staker].durationDays % 28
                : 28;
        }

        stakers[staker].currentCycle += 1;

        stakers[staker].claimableAmount += getRewards(
            stakers[staker].stakedAmount + stakers[staker].claimableAmount,
            newApy,
            cycleDays
        );

        if (stakers[staker].pendingAmount > 0) {
            stakers[staker].stakedAmount += stakers[staker].pendingAmount;
            stakers[staker].pendingAmount = 0;
        }
    }

    // stakers

    function stake(uint256 amount, uint256 days_) public {
        require(stakers[msg.sender].stakedAmount == 0, "ALREADY_STAKING");
        require(days_ >= 21 && days_ <= 365, "STAKING_DAYS_OUT_OF_BOUNDS");
        require(amount > 0, "CANT_STAKE_ZERO_AMOUNT");
        require(
            IERC20(stakeToken).allowance(msg.sender, address(this)) >= amount,
            "NOT_ENOUGH_ALLOWANCE"
        );

        IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);

        stakers[msg.sender] = Staker(amount, 0, 0, _now() + (days_ * 1 days), days_, 0, 1);
    }

    function addToStake(uint256 amount) public {
        require(stakers[msg.sender].stakedAmount > 0, "STAKED_AMOUNT_IS_ZERO");
        require(
            stakers[msg.sender].currentCycle < _getFinalCycle(stakers[msg.sender].durationDays) - 1,
            "FINAL_CYCLE"
        );
        require(
            IERC20(stakeToken).allowance(msg.sender, address(this)) >= amount,
            "NOT_ENOUGH_ALLOWANCE"
        );

        IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);
        stakers[msg.sender].pendingAmount += amount;
    }

    function getTotalStaked(address staker) public view returns (uint256) {
        return stakers[staker].stakedAmount + stakers[staker].claimableAmount;
    }

    function getPendingAmount(address staker) public view returns (uint256) {
        return stakers[staker].pendingAmount;
    }

    function getApy(address staker) public view returns (uint256) {
        return stakers[staker].apy;
    }

    function claimRewards() public {
        require(stakers[msg.sender].claimableAmount > 0, "CLAIMABLE_AMOUNT_IS_ZERO");

        IERC20(stakeToken).transfer(msg.sender, stakers[msg.sender].claimableAmount);
        stakers[msg.sender].claimableAmount = 0;
    }

    function claimAll() public {
        require(stakers[msg.sender].lockedUntil <= _now(), "LOCKED");
        require(stakers[msg.sender].stakedAmount > 0, "STAKED_AMOUNT_IS_ZERO");
        require(
            stakers[msg.sender].currentCycle == _getFinalCycle(stakers[msg.sender].durationDays),
            "FINAL_APY_NOT_APPLIED"
        );

        IERC20(stakeToken).transfer(
            msg.sender,
            stakers[msg.sender].claimableAmount + stakers[msg.sender].stakedAmount
        );

        delete stakers[msg.sender];
    }

    // math

    // Daily compound interest rate
    // apy_: apy * 10 ** 2 (multiplied by 10**2 for decimal points)
    // formula: ((1 + apy / 100) ^ (1 / 365)) - 1

    function getInterestRateFromApy(uint256 apy_) public pure returns (PRB.UD60x18) {
        return
            PRB.sub(
                PRB.pow(
                    PRB.add(PRB.convert(1), PRB.div(PRB.convert(apy_), PRB.convert(10 ** 4))),
                    PRB.inv(PRB.convert(365))
                ),
                PRB.convert(1)
            );
    }

    // TODO: add staking duration
    // TODO: implement claiming (currently only returning reward amount)

    // Get rewards amount
    // rate: interest rate
    // s: initial staked amount
    // days: staking duration in days

    // formula: s * ((1 + rate) ^ days) - s
    function getRewards(uint256 s, uint256 apy_, uint256 days_) public pure returns (uint256) {
        return
            PRB.convert(
                PRB.sub(
                    PRB.mul(
                        PRB.convert(s),
                        PRB.pow(
                            PRB.add(PRB.convert(1), getInterestRateFromApy(apy_)),
                            PRB.convert(days_)
                        )
                    ),
                    PRB.convert(s)
                )
            );
    }

    // helpers

    function _now() private view returns (uint256) {
        return block.timestamp;
    }

    function _getStakeStartdate(
        uint256 lockedUntil,
        uint256 durationDays
    ) private pure returns (uint256) {
        return (lockedUntil - durationDays * 1 days);
    }

    function _getFinalCycle(uint256 days_) private pure returns (uint256) {
        return days_ % 28 == 0 ? (days_ / 28) + 1 : (days_ / 28) + 2;
    }
}
