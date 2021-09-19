const DappToken = artifacts.require("./DappToken.sol");
const DappTokenCrowdsale = artifacts.require("./DappTokenCrowdsale.sol");

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n, 'ether'));

const duration = {
  seconds: function (val) { return val; },
  minutes: function (val) { return val * this.seconds(60); },
  hours: function (val) { return val * this.minutes(60); },
  days: function (val) { return val * this.hours(24); },
  weeks: function (val) { return val * this.days(7); },
  years: function (val) { return val * this.days(365); },
};

module.exports = async function(deployer, network, accounts) {
  const _name = "Ember Token";
  const _symbol = "EMB";
  const _decimals = 18;

  await deployer.deploy(DappToken, _name, _symbol, _decimals);
  const deployedToken = await DappToken.deployed();

  // const latestTime = (new Date).getTime();

  const _rate           = 45000;
  const _wallet         = accounts[0]; // TODO: Replace me
  const _token          = deployedToken.address;


  const latestBlock = await web3.eth.getBlockNumber();
  var tempLatestTime;// = await web3.eth.getBlock(latestBlock).timestamp;
  await web3.eth.getBlock(latestBlock, function(error, result){
     if(!error) {
       // console.log(JSON.stringify(result));
       tempLatestTime = result.timestamp;
     }
     else {
       console.log("error")
       console.error(error);
     }
  })

  // this.openingTime = tempLatestTime + duration.weeks(1);
  // this.closingTime = this.openingTime + duration.weeks(1);

  const _openingTime    = tempLatestTime + duration.minutes(1);
  const _closingTime    = _openingTime + duration.weeks(1);



  const _cap            = ether('11111');
  const _goal           = ether('50');
  const _foundationFund = accounts[4]; // TODO: Replace me
  const _liquidityAndMarketingFund   = accounts[5]; // TODO: Replace me
  const _gameFund   = accounts[6]; // TODO: Replace me
  const _releaseTime    = _closingTime + duration.days(1);

  await deployer.deploy(
    DappTokenCrowdsale,
    _rate,
    _wallet,
    _token,
    _cap,
    _openingTime,
    _closingTime,
    _foundationFund,
    _liquidityAndMarketingFund,
    _gameFund,
    _releaseTime
  );

  return true;
};
