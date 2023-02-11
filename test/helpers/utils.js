async function waitTx(tx) {
  return (await tx).wait();
}

async function addStaker(contracts, account, amount, durationDays) {
  await waitTx(
    contracts.stakeToken.connect(account).approve(contracts.stake.address, amount)
  );
  await waitTx(contracts.stake.connect(account).stake(amount, durationDays));
}

async function addToStake(contracts, account, amount) {
  await waitTx(
    contracts.stakeToken.connect(account).approve(contracts.stake.address, amount)
  );
  await waitTx(contracts.stake.connect(account).addToStake(amount));
}


module.exports = {
  waitTx,
  addStaker,
  addToStake
};
