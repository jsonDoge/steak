async function waitTx(tx) {
  return (await tx).wait();
}

module.exports = {
  waitTx,
};
