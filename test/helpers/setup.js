const setupContracts = async (ownerAddress) => {
  const StakeFactory = await ethers.getContractFactory('Stake');
  const stakeContract = await StakeFactory.deploy();
  await stakeContract.deployTransaction.wait();

  const StakeTokenFactory = await ethers.getContractFactory('ERC20PresetFixedSupply');
  const stakeTokenContract = await StakeTokenFactory.deploy('StakeToken', 'ST', 100, ownerAddress);
  await stakeTokenContract.deployTransaction.wait();

  return {
    stakeContract,
    stakeTokenContract,
  };
};

module.exports = {
  setupContracts,
};
