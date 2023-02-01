const setupContracts = async (ownerAddress) => {
  const StakeTokenFactory = await ethers.getContractFactory('ERC20PresetFixedSupply');
  const stakeToken = await StakeTokenFactory.deploy('StakeToken', 'ST', 100, ownerAddress);
  await stakeToken.deployTransaction.wait();

  const StakeFactory = await ethers.getContractFactory('Stake');
  const stake = await StakeFactory.deploy(stakeToken.address);
  await stake.deployTransaction.wait();

  return {
    stake,
    stakeToken,
  };
};

module.exports = {
  setupContracts,
};
