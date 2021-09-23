const EmbToken = artifacts.require("./EmbToken.sol");
const EmbTokenCrowdsale = artifacts.require("./EmbTokenCrowdsale.sol");

module.exports = async function(deployer, network, accounts) {
  const _name = "Ember Token";
  const _symbol = "EMB";
  const _decimals = 18;
  const _supply = 5000000000;

  await deployer.deploy(EmbToken, _name, _symbol, _decimals, _supply);
  const deployedToken = await EmbToken.deployed();

  const _rate           = 45000;
  const _wallet         = accounts[0];
  const _token          = deployedToken.address;
  const _foundationFund = accounts[4];
  const _liquidityAndMarketingFund   = accounts[5];
  const _gameFund   = accounts[6]; 

  await deployer.deploy(
    EmbTokenCrowdsale,
    _rate,
    _wallet,
    _token,
    _foundationFund,
    _liquidityAndMarketingFund,
    _gameFund
  );

  return true;
};
