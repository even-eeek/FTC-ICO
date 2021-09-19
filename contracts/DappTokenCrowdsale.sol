pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol";
import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
/* import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol"; */
import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";

contract DappTokenCrowdsale is Crowdsale, MintedCrowdsale , CappedCrowdsale, TimedCrowdsale, WhitelistedCrowdsale, FinalizableCrowdsale {

  // Track investor contributions
  uint256 public investorMinCap =  200000000000000000; // 0.2 ether
  uint256 public investorHardCap = 6000000000000000000; // 6 ether
  mapping(address => uint256) public contributions;

  // Crowdsale Stages
  enum CrowdsaleStage { PreICO, ICO, PostICO }
  // Default to presale stage
  CrowdsaleStage public stage = CrowdsaleStage.PreICO;

  // Token Distribution
  uint256 public tokenSalePercentage                = 10;
  uint256 public foundationPercentage               = 10;
  uint256 public liquidityAndMarketingPercentage    = 10;
  uint256 public gamePercentage                     = 70;

  // Token reserve funds
  address public liquidityAndMarketingFund;
  address public foundationFund;
  address public gameFund;

  // Token time lock
  uint256 public releaseTime;
  address public foundationTimelock;
  address public liquidityAndMarketingTimelock;
  address public gameTimelock;

  constructor(
    uint256 _rate,
    address _wallet,
    ERC20 _token,
    uint256 _cap,
    uint256 _openingTime,
    uint256 _closingTime,
    address _foundationFund,
    address _liquidityAndMarketingFund,
    address _gameFund,
    uint256 _releaseTime
  )
    Crowdsale(_rate, _wallet, _token)
    CappedCrowdsale(_cap)
    TimedCrowdsale(_openingTime, _closingTime)
    /*RefundableCrowdsale(_goal) */
    public
  {
    foundationFund = _foundationFund;
    liquidityAndMarketingFund   = _liquidityAndMarketingFund;
    gameFund   = _gameFund;
    releaseTime    = _releaseTime;
  }

  /**
  * @dev Returns the amount contributed so far by a sepecific user.
  * @param _beneficiary Address of contributor
  * @return User contribution so far
  */
  function getUserContribution(address _beneficiary)
    public view returns (uint256)
  {
    return contributions[_beneficiary];
  }

  /**
  * @dev Allows admin to update the crowdsale stage
  * @param _stage Crowdsale stage
  */
  function setCrowdsaleStage(uint _stage) public onlyOwner {
    require(CrowdsaleStage.PostICO != stage, "Trying to set stage when the PostICO is active");
    require(CrowdsaleStage.ICO != stage && uint(CrowdsaleStage.PreICO) != _stage, "Trying to set stage to PreIco when ICO is active");
    if(uint(CrowdsaleStage.PreICO) == _stage) {
      stage = CrowdsaleStage.PreICO;
    } else if (uint(CrowdsaleStage.ICO) == _stage) {
      stage = CrowdsaleStage.ICO;
    } else if (uint(CrowdsaleStage.PostICO) == _stage) {
      stage = CrowdsaleStage.PostICO;
    }

    if(stage == CrowdsaleStage.PreICO) {
      rate = 45000;
    } else if (stage == CrowdsaleStage.ICO) {
      rate = 15000;
    }
  }

  /**
  * @dev Allows admin to update the crowdsale rate
  * @param _rate Crowdsale rate
  */
  function setCrowdsaleRate(uint _rate) public onlyOwner {
    rate = _rate;
  }

  /**
   * @dev forwards funds to the wallet during the PreICO stage, then the refund vault during ICO stage
   */
  function _forwardFunds() internal {
    if(stage == CrowdsaleStage.PreICO) {
      wallet.transfer(msg.value);
    } else if (stage == CrowdsaleStage.ICO) {
      super._forwardFunds();
    }
  }

  /**
  * @dev Extend parent behavior requiring purchase to respect investor min/max funding cap.
  * @param _beneficiary Token purchaser
  * @param _weiAmount Amount of wei contributed
  */
   function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  )
    internal
  {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    uint256 _existingContribution = contributions[_beneficiary];
    uint256 _newContribution = _existingContribution.add(_weiAmount);
    require(_newContribution >= investorMinCap && _newContribution <= investorHardCap);
    contributions[_beneficiary] = _newContribution;
  }


  /**
   * @dev enables token transfers, called when owner calls finalize()
  */
  function finalization() internal {
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    if(CrowdsaleStage.PostICO == stage) {
      MintableToken _mintableToken = MintableToken(token);
      uint256 _alreadyMinted = _mintableToken.totalSupply();

      uint256 _finalTotalSupply = _alreadyMinted.div(tokenSalePercentage).mul(100);

      foundationTimelock = new TokenTimelock(token, foundationFund, releaseTime);
      liquidityAndMarketingTimelock   = new TokenTimelock(token, liquidityAndMarketingFund, releaseTime);
      gameTimelock   = new TokenTimelock(token, gameFund, releaseTime);

      _mintableToken.mint(address(foundationTimelock), _finalTotalSupply.mul(foundationPercentage).div(100));
      _mintableToken.mint(address(liquidityAndMarketingTimelock),   _finalTotalSupply.mul(liquidityAndMarketingPercentage).div(100));
      _mintableToken.mint(address(gameTimelock),   _finalTotalSupply.mul(gamePercentage).div(100));

      _mintableToken.finishMinting();
      // Unpause the token
    }

    super.finalization();
  }

}
