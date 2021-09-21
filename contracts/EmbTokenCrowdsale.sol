pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
/* import "openzeppelin-solidity/contracts/crowdsale/validation/PausableCrowdsale.sol"; */
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import './TokenVestingPool.sol';

contract EmbTokenCrowdsale is CappedCrowdsale, FinalizableCrowdsale {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;
  // Track investor contributions
  uint256 public investorMinCap =  200000000000000000; // 0.2 ether
  uint256 public investorHardCap = 6000000000000000000; // 6 ether

  mapping(address => uint256) public contributions;
  mapping (uint256 => address ) private holders;

  bool public tokenSalePaused = false;
  uint256 totalHolders = 0;
  uint256 m_weiRaised;
  uint256 m_rate;
  ERC20 m_token;

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

  uint256 constant public TOKEN_SALE_LENGTH = 4 weeks;//365 days; // !!! for real ICO change to 365 days
  uint256 constant public TOKEN_SALE_PERIODS = 20; // 10 years (!!! for real ICO it would be 10 years)
  uint256 constant public GAME_PERIOD_LENGTH = 52 weeks;
  uint256 constant public GAME_PERIODS = 7;

  uint256 constant public FCHAIN_FOUNDATION_SHARE_1 = 50000000 ether;
  uint256 constant public FCHAIN_FOUNDATION_PERIOD_LENGTH_1 = 4 weeks;//365 days; // !!! for real ICO change to 365 days
  uint256 constant public FCHAIN_FOUNDATION_PERIODS_1 = 10; // 10 years (!!! for real ICO it would be 10 years)

  uint256 constant public FCHAIN_FOUNDATION_SHARE_2 = 450000000 ether;
  uint256 constant public FCHAIN_FOUNDATION_PERIOD_LENGTH_2 = 4 weeks;
  uint256 constant public FCHAIN_FOUNDATION_PERIODS_2 = 18;


  uint256 constant public LIQUIDITY_AND_MARKETING_SHARE = 500000000 ether;


  TokenVestingPool public tokenSaleEscrow;
  TokenVestingPool public foundationEscrow1;
  TokenVestingPool public foundationEscrow2;
  TokenVestingPool public gameEscrow;

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
    /* FinalizableCrowdsale() */
    public
  {
    foundationFund = _foundationFund;
    liquidityAndMarketingFund   = _liquidityAndMarketingFund;
    gameFund   = _gameFund;
    totalHolders = 0;
    m_token = _token;


  }

  /**
  * @dev Extend parent behavior requiring purchase to respect investor min/max funding cap.
  * @param _beneficiary Token purchaser
  * @param _weiAmount Amount of wei contributed
  */
   /* function _preValidatePurchase( address _beneficiary, uint256 _weiAmount)  internal view   {
    super._preValidatePurchase(_beneficiary, _weiAmount);
   } */

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public payable {
    require(CrowdsaleStage.PostICO != stage, "Trying to buy tokens when the PostICO stage is active");
    require(CrowdsaleStage.PreICO == stage && m_weiRaised <= m_token.totalSupply().div(100).mul(3), "Trying to buy tokens in preICO when all token have been sold" );
    require(CrowdsaleStage.ICO == stage && m_weiRaised <= m_token.totalSupply().div(10), "Trying to buy tokens in ICO when all token have been sold" );

    uint256 weiAmount = msg.value;
    _preValidatePurchase(_beneficiary, weiAmount);

    uint256 _existingContribution = contributions[_beneficiary];
    uint256 _newContribution = _existingContribution.add(weiAmount);
    require(_newContribution >= investorMinCap && _newContribution <= investorHardCap);
    contributions[_beneficiary] = _newContribution;
    holders[totalHolders] = _beneficiary;
    totalHolders.add(1);

    // update state
    m_weiRaised = m_weiRaised.add(weiAmount);
    if(m_weiRaised >= m_token.totalSupply().div(100).mul(3) && CrowdsaleStage.PreICO == stage) {
      stage = CrowdsaleStage.ICO;
    } else if(m_weiRaised >= m_token.totalSupply().div(10) && CrowdsaleStage.ICO == stage) {
      stage = CrowdsaleStage.PostICO;
    }
  }

  function pauseTokenSale() public onlyOwner {
      tokenSalePaused = true;
  }

  function unpauseTokenSale() public onlyOwner {
      tokenSalePaused = false;
  }

  /**
  * @dev Returns the amount contributed so far by a sepecific user.
  * @param _beneficiary Address of contributor
  * @return User contribution so far
  */
  function getUserContribution(address _beneficiary) public view returns (uint256) {
    return contributions[_beneficiary];
  }

  /**
  * @dev Allows admin to update the crowdsale stage
  * @param _stage Crowdsale stage
  */
  function incrementCrowdsaleStage(uint256 _stage) public onlyOwner {
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
      m_rate = 45000;
    } else if (stage == CrowdsaleStage.ICO) {
      m_rate = 15000;
    }
  }

  /**
  * @dev Allows admin to update the crowdsale rate
  * @param _rate Crowdsale rate
  */
  function setCrowdsaleRate(uint256 _rate) public onlyOwner {
    require(CrowdsaleStage.PostICO != stage, "Trying to set rate when the PostICO is active");
    m_rate = _rate;
  }

  /**
   * @dev enables token transfers, called when owner calls finalize()
  */
  function _finalization() internal {
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");


    m_token.safeTransfer(liquidityAndMarketingFund, LIQUIDITY_AND_MARKETING_SHARE);

    foundationEscrow1 = new TokenVestingPool(m_token, FCHAIN_FOUNDATION_SHARE_1);
    foundationEscrow1.addBeneficiary(foundationFund, block.timestamp, 30 days, 300 days, FCHAIN_FOUNDATION_SHARE_1);
    foundationEscrow2 = new TokenVestingPool(m_token, FCHAIN_FOUNDATION_SHARE_2);
    foundationEscrow2.addBeneficiary(foundationFund, 40 weeks, 1 days, 540 days, FCHAIN_FOUNDATION_SHARE_2);


    tokenSaleEscrow = new TokenVestingPool(m_token, m_weiRaised);
    //address[] memory benecificiaries = new address[](totalHolders);
    //uint256[] memory amounts  = new uint256[](totalHolders);
    for(uint256 i = 0 ; i < totalHolders; i++) {
        address beneficiary = holders[i];
        //benecificiaries[i] = beneficiary;
        uint256 contribution = contributions[beneficiary];
        //amounts[i] = contribution;
        tokenSaleEscrow.addBeneficiary(beneficiary, block.timestamp, 30 days, 600 days, contribution);
    }
    //tokenSaleEscrow.addBulkBeneficiary(benecificiaries, block.timestamp, 30 days, 600 days, amounts);

    uint256 gameConstribution = (((m_token.totalSupply().sub(m_weiRaised)).sub(FCHAIN_FOUNDATION_SHARE_1)).sub(FCHAIN_FOUNDATION_SHARE_2)).sub(LIQUIDITY_AND_MARKETING_SHARE);
    gameEscrow = new TokenVestingPool(m_token, gameConstribution);
    gameEscrow.addBeneficiary(gameFund, block.timestamp, 30 days, 2555 days, gameConstribution);


    super.finalize();
  }

  /**
   * @dev enables token releaseTokenSaleVestedFunds
  */
  /* function releaseTokenSaleVestedFunds(address beneficiary) public{
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    tokenSaleEscrow.unlockFor(beneficiary);
  } */

  /**
   * @dev enables token releaseFoundationVestedFunds
  */
  /* function releaseFoundationVestedFunds() public onlyOwner {
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    tokenSaleEscrow.unlockFor(foundationFund);
  } */

  /**
   * @dev enables token releaseFoundationVestedFunds
  */
  /* function releaseGameVestedFunds() public onlyOwner {
    require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

    tokenSaleEscrow.unlockFor(gameFund);
  } */

}
