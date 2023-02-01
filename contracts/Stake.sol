// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Stake {
    address private stakeToken;

    mapping(address => uint256) private stakedAmount;

    constructor(address stakeToken_) {
        stakeToken = stakeToken_;
    }

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
