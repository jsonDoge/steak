// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@prb/math/src/UD60x18.sol" as PRB;

contract Stake {
    address private admin;
    address private stakeToken;

    mapping(address => uint256) private stakedAmount;
    mapping(address => uint256) private claimableAmount;
    mapping(address => uint256) private lockedUntil;

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
        require(lockedUntil[staker] > 0, "STAKER_NOT_FOUND");

        apy[staker] = newApy;

        uint256 daysLeft = (lockedUntil[staker] - _now()) / 86400;
        uint256 cycleDays = daysLeft > 28 ? 28 : daysLeft;

        claimableAmount[staker] += getRewards(stakedAmount[staker], newApy, cycleDays);
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

        stakedAmount[msg.sender] = amount;
        lockedUntil[msg.sender] = _now() + (days_ * 1 days);
    }

    function getTotalStaked(address addr) public view returns (uint256) {
        return stakedAmount[addr];
    }

    function getApy(address addr) public view returns (uint256) {
        return apy[addr];
    }

    function claimRewards() public {
        require(claimableAmount[msg.sender] > 0, "CLAIMABLE_AMOUNT_IS_ZERO");

        IERC20(stakeToken).transfer(msg.sender, claimableAmount[msg.sender]);
        claimableAmount[msg.sender] = 0;
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
}
