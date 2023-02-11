async function waitTx(tx) {
  return (await tx).wait();
}

async function addStaker(contracts, account, amount, durationDays) {
  await waitTx(
    contracts.stakeToken.connect(account).approve(contracts.stake.address, amount)
  );
  await waitTx(contracts.stake.connect(account).stake(amount, durationDays));
}

module.exports = {
  waitTx,
  addStaker
};
