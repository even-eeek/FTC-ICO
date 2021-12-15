const { BN } = require('@openzeppelin/test-helpers');

export default function ether (n) {
  return new BN(web3.utils.toWei(n, 'ether'));
}
