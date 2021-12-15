/**
 * @param {Object} transaction the transaction where the event was emitted.
 * @param {String} eventName the name of emitted event.
 * @param {String} message to display on error.
 * @throws {AssertionError} when the error is not originated from a revert.
 */
export function assertEvent(transaction, eventName, message = '') {
  const hasEvent = transaction.logs.some(log => log.event === eventName);
  assert(hasEvent, message);
}

/**
 * @param {Object} transaction the transaction where the event was emitted.
 */
export function extractEventArgs(transaction) {
  return transaction.logs[0].args;
}

/**
 * @param {Error} error the error where the assertion is made.
 * @throws {AssertionError} when the error is not originated from a revert.
 */
export function assertRevert(error) {
  assert(error.toString().includes('revert'), error.toString());
}

/**
 * @param {Number} Number of seconds to increase EVM time.
 * @throws {Error} when it fails to increase time or mine the block after.
 */
export function increaseTime(duration) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id,
    }, (errIncreaseTime) => { // eslint-disable-line consistent-return
      if (errIncreaseTime) return reject(errIncreaseTime);

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (errMine, res) => (errMine ? reject(errMine) : resolve(res)));
    });
  });
}

// Advance to the next block
export function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: Date.now(),
    }, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

// Returns the time of the last mined block in seconds
export async function now() {
  let now;

  const latestBlock = await web3.eth.getBlockNumber();
  await web3.eth.getBlock(latestBlock, function(error, result){
     if(!error) {
       // console.log(JSON.stringify(result));
       now = result.timestamp;
     }
     else {
       console.log("error")
       console.error(error);
     }
  })

  return now;
}
