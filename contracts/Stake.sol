// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Stake {
    address private admin;
    address private stakeToken;

    mapping(address => uint256) private stakedAmount;
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

    function getTotalStaked(address addr) public view returns(uint256) {
      return stakedAmount[addr];
    }
}
