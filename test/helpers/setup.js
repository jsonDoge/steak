const BN = require('bignumber.js');

const setupContracts = async (ownerAddress) => {
  const StakeTokenFactory = await ethers.getContractFactory('ERC20PresetFixedSupply');
  const stakeToken = await StakeTokenFactory.deploy(
    'StakeToken',
    'ST',
    BN(1000).times(BN(10).pow(18)).toFixed(),
    ownerAddress
  );
  await stakeToken.deployTransaction.wait();

  const StakeFactory = await ethers.getContractFactory('Stake');
  const stake = await StakeFactory.deploy(ownerAddress, stakeToken.address);
  await stake.deployTransaction.wait();

  return {
    stake,
    stakeToken,
  };
};

module.exports = {
  setupContracts,
};
