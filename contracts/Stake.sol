// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@prb/math/src/UD60x18.sol" as PRB;

contract Stake {
    uint256 public constant BLOCKS_IN_DAY = 7200;

    address private admin;
    address private stakeToken;

    mapping(address => uint256) private stakedAmount;
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
        apy[staker] = newApy;
    }

    // stakers

    function stake(uint256 amount) public {
        require(amount > 0, "CANT_STAKE_ZERO_AMOUNT");
        require(
            IERC20(stakeToken).allowance(msg.sender, address(this)) >= amount,
            "NOT_ENOUGH_ALLOWANCE"
        );

        stakedAmount[msg.sender] += amount;
    }

    function getTotalStaked(address addr) public view returns (uint256) {
        return stakedAmount[addr];
    }

    function getApy(address addr) public view returns (uint256) {
        return apy[addr];
    }

    // daily compound interest rate
    // apy_ - apy * 10 ** 2 (multiplied by 10**2 for decimal points)
    // formula - ((1 + apy / 100) ^ (1 / 365)) - 1

    function getInterestRateFromApy(uint256 apy_) public pure returns (PRB.UD60x18) {
        return
            PRB.sub(
                PRB.pow(
                    PRB.add(PRB.convert(1), PRB.div(PRB.convert(apy_), PRB.convert(10 ** 4))),
                    PRB.div(PRB.convert(1), PRB.convert(365))
                ),
                PRB.convert(1)
            );
    }

    // TODO: add staking duration
    // TODO: implement claiming (currently only returning reward amount)

    // Claim reward amount
    // rate - interest rate
    // S - initial staked amount
    // days - days from

    // S * (1 + rate) ^ (days)
    function claimRewards(address addr, uint256 days_) public view returns (uint256) {
        return
            PRB.convert(
                PRB.sub(
                    PRB.mul(
                        PRB.convert(stakedAmount[addr]),
                        PRB.pow(
                            PRB.add(PRB.convert(1), getInterestRateFromApy(apy[addr])),
                            PRB.convert(days_)
                        )
                    ),
                    PRB.convert(stakedAmount[addr])
                )
            );
    }
}
