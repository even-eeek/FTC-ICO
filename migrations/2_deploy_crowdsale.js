const FtcToken = artifacts.require("./FtcToken.sol");
const FtcTokenCrowdsale = artifacts.require("./FtcTokenCrowdsale.sol");

module.exports = async function(deployer, network, accounts) {
  const _name = "Forgotten Coin";
  const _symbol = "FTC";
  const _decimals = 18;
  const _supply = 5000000000;

  await deployer.deploy(FtcToken, _name, _symbol, _decimals, _supply);
  const deployedToken = await FtcToken.deployed();

  const _rate                        = 45000;
  const _wallet                      = accounts[0];
  const _token                       = deployedToken.address;
  const _foundationFund              = accounts[0];
  const _liquidityAndMarketingFund   = accounts[0];
  const _gameFund                    = accounts[0];

  await deployer.deploy(
    FtcTokenCrowdsale,
    _rate,
    _wallet,
    _token,
    _foundationFund,
    _liquidityAndMarketingFund,
    _gameFund
  );

  return true;
};
