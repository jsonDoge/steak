// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Stake {

  address stakeToken;

  constructor (address _stakeToken) {
    stakeToken = _stakeToken;
  }

  function stake (uint256 amount) public {
    require(amount > 0, "CANT_STAKE_ZERO_AMOUNT");
    require(IERC20(stakeToken).allowance(msg.sender, address(this)) >= amount, "NOT_ENOUGH_ALLOWANCE");
  }
}
