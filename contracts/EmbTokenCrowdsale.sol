pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";

import './MultiBeneficiaryTokenVesting.sol';
contract EmbTokenCrowdsale is CappedCrowdsale, FinalizableCrowdsale {

  // Track investor contributions
  uint256 public investorMinCap =  200000000000000000; // 0.2 ether
  uint256 public investorHardCap = 6000000000000000000; // 6 ether

  mapping(address => uint256) public contributions;
  mapping (uint256=> address ) private holders;

  uint256 totalHolders;

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

  MultiBeneficiaryTokenVesting public tokenSaleVesting;
  MultiBeneficiaryTokenVesting public foundationVesting;
  MultiBeneficiaryTokenVesting public liquidityAndMarketingVesting;
  MultiBeneficiaryTokenVesting public gameVesting;

  ERC20 token;

  constructor(
    uint256 _rate,
    address _wallet,
    ERC20 _token,
    uint256 _cap,
    address _foundationFund,
    address _liquidityAndMarketingFund,
    address _gameFund
  )
    Crowdsale(_rate, _wallet, _token)
    CappedCrowdsale(_cap)
    public
  {
    foundationFund = _foundationFund;
    liquidityAndMarketingFund   = _liquidityAndMarketingFund;
    gameFund   = _gameFund;
    totalHolders = 0;
    token = _token;
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public  payable {
    require(CrowdsaleStage.PostICO != stage, "Trying to buy tokens when the PostICO stage is active");
    require(CrowdsaleStage.PreICO == stage && weiRaised <= token.totalSupply().div(100).mul(3), "Trying to buy tokens in preICO when all token have been sold" );
    require(CrowdsaleStage.ICO == stage && weiRaised <= token.totalSupply().div(10), "Trying to buy tokens in ICO when all token have been sold" );

    uint256 weiAmount = msg.value;
    _preValidatePurchase(_beneficiary, weiAmount);
    // update state
    weiRaised = weiRaised.add(weiAmount);
    if(weiRaised >= token.totalSupply().div(100).mul(3) && CrowdsaleStage.PreICO == stage) {
      stage = CrowdsaleStage.ICO;
    } else if(weiRaised >= token.totalSupply().div(10) && CrowdsaleStage.ICO == stage) {
      stage = CrowdsaleStage.PostICO;
    }
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
  function incrementCrowdsaleStage(uint _stage) public onlyOwner {
    require(CrowdsaleStage.PostICO != stage, "Trying to set stage when the PostICO is active");
    /* require(CrowdsaleStage.ICO != stage && (uint(CrowdsaleStage.PreICO) != _stage), "Trying to set stage to PreIco when ICO is active"); */
    require(uint(stage) == _stage + 1, "Trying to set stage incorectly");

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
    require(CrowdsaleStage.PostICO != stage, "Trying to set rate when the PostICO is active");
    rate = _rate;
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
    holders[totalHolders] = _beneficiary;
    totalHolders.add(1);
  }

  /**
   * @dev enables token transfers, called when owner calls finalize()
  */
  function finalization() internal{
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    tokenSaleVesting = new MultiBeneficiaryTokenVesting(
       token,
       block.timestamp,
       30 days,
       80 weeks
     );

     uint256 contribution;
     for(uint i = 0 ; i < totalHolders; i++) {
         address beneficiary = holders[i];
         contribution = contributions[beneficiary];
         tokenSaleVesting.addBeneficiary(beneficiary, contribution);
     }

     foundationVesting  = new MultiBeneficiaryTokenVesting(
        token,
        block.timestamp,
        30 days,
        90 days
      );

      uint256 foundationContribution = token.totalSupply().div(100) * foundationPercentage * 10 ** 18;
      foundationVesting.addBeneficiary(foundationFund, foundationContribution);

     liquidityAndMarketingVesting = new MultiBeneficiaryTokenVesting(
        token,
        block.timestamp,
        0 days,
        0 days
      );

      uint256 liquidityAndMarketingContribution = token.totalSupply().div(100) * liquidityAndMarketingPercentage * 10 ** 18;
      liquidityAndMarketingVesting.addBeneficiary(liquidityAndMarketingFund, liquidityAndMarketingContribution);

     gameVesting  = new MultiBeneficiaryTokenVesting(
        token,
        block.timestamp,
        52 weeks,
        7 * 52 weeks
      );

      uint256 remainingContribution = ((token.totalSupply().sub(weiRaised)).sub(foundationContribution)).sub(liquidityAndMarketingContribution);

      /* gameContribution = token.totalSupply().div(100) * gamePercentage * 10 ** 18; */
      gameVesting.addBeneficiary(gameFund, remainingContribution);
      super.finalization();
  }

  /**
   * @dev enables token releaseVestedFunds
  */
  function releaseVestedFunds() internal {
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    tokenSaleVesting.releaseAllTokens();
    foundationVesting.releaseAllTokens();
    liquidityAndMarketingVesting.releaseAllTokens();
    gameVesting.releaseAllTokens();


      /* MintableToken _mintableToken = MintableToken(token);
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
      */

  }

}
