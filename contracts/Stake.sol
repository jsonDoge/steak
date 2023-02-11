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
        uint256 lockedUntil;
        uint256 durationDays;
        uint8 currentCycle;
    }

    mapping(address => Staker) private stakers;

    // is stored as 0.01% units
    mapping(address => uint256) private apy;

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
            _now() - getStakeStartdate(stakers[staker].lockedUntil, stakers[staker].durationDays) >=
                stakers[staker].currentCycle * 28 days,
            "CYCLE_HAS_NOT_ENDED"
        );

        apy[staker] = newApy;

        uint256 cycleDays = 28;
        if (stakers[staker].lockedUntil < _now()) {
            cycleDays =
                getStakeStartdate(stakers[staker].lockedUntil, stakers[staker].durationDays) -
                stakers[staker].currentCycle *
                28 days;
        }

        stakers[staker].currentCycle += 1;

        stakers[staker].claimableAmount += getRewards(
            stakers[staker].stakedAmount + stakers[staker].claimableAmount,
            newApy,
            cycleDays
        );
    }

    // stakers

    function stake(uint256 amount, uint256 days_) public {
        require(days_ >= 21 && days_ <= 365, "STAKING_DAYS_OUT_OF_BOUNDS");
        require(amount > 0, "CANT_STAKE_ZERO_AMOUNT");
        require(
            IERC20(stakeToken).allowance(msg.sender, address(this)) >= amount,
            "NOT_ENOUGH_ALLOWANCE"
        );

        IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);

        stakers[msg.sender] = Staker(amount, 0, _now() + (days_ * 1 days), days_, 1);
    }

    function getTotalStaked(address staker) public view returns (uint256) {
        return stakers[staker].stakedAmount;
    }

    function getApy(address staker) public view returns (uint256) {
        return apy[staker];
    }

    function claimRewards() public {
        require(stakers[msg.sender].claimableAmount > 0, "CLAIMABLE_AMOUNT_IS_ZERO");

        IERC20(stakeToken).transfer(msg.sender, stakers[msg.sender].claimableAmount);
        stakers[msg.sender].claimableAmount = 0;
    }

    function claimAll() public {
        require(stakers[msg.sender].lockedUntil > _now(), "STAKED_AMOUNT_IS_ZERO");
        require(stakers[msg.sender].stakedAmount > 0, "STAKED_AMOUNT_IS_ZERO");

        IERC20(stakeToken).transfer(
            msg.sender,
            stakers[msg.sender].claimableAmount + stakers[msg.sender].stakedAmount
        );

        stakers[msg.sender].claimableAmount = 0;
        stakers[msg.sender].stakedAmount = 0;

        // Optional: Not necessary to reset before second staking
        stakers[msg.sender].lockedUntil = 0;
        apy[msg.sender] = 0;
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

    function getStakeStartdate(
        uint256 lockedUntil,
        uint256 durationDays
    ) public pure returns (uint256) {
        return (lockedUntil - durationDays * 1 days);
    }
}
