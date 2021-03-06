// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './TokenVestingPool.sol';
import "./OZ_legacy/TokenVesting.sol";


contract FtcTokenCrowdsale is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    AggregatorV3Interface internal priceFeed;
    //false means ChainLink getLatestPrice. true means price set by owner
    bool public priceFlag = false;
    uint256 public ownerPrice = 0;

    // The token being sold
    ERC20 public token;

    // Address where funds are collected
    address payable public wallet;

    // How many token units a buyer gets per wei
    uint256 public rate;

    // How many wei have been raised
    uint256 public weiRaised;

    uint256 public investorMinCap = 200000000000000000; // 0.2 bnb
    uint256 public investorHardCap = 3000000000000000000; // 3 bnb

    mapping(address => uint256) public tokenPurchases;
    mapping(address => uint256) public tokenPayments;
    mapping(uint256 => address) private beneficiaries;

    uint256 public totalTokensPurchased;
    uint256 public totalBeneficiaries;

    // Crowdsale Stages
    enum CrowdsaleStage {PreICO, ICO, PostICO}
    CrowdsaleStage public stage = CrowdsaleStage.PreICO;

    bool public tokenDistributionComplete = false;

    TokenVesting foundationEscrow1;
    TokenVesting foundationEscrow2;
    TokenVesting gameEscrow;
    TokenVestingPool tokenSaleEscrow;

    address public liquidityAndMarketingFund;
    address public foundationFund;
    address public gameFund;

    uint256 public startEscrowTimestamp;

    uint256 constant public LIQUIDITY_AND_MARKETING_SHARE = 500000000000000000000000000;

    uint256 constant public FOUNDATION_1_ESCROW_SHARE = 50000000000000000000000000;
    uint256 constant public FOUNDATION_1_ESCROW_CLIFF = 30 days;
    uint256 constant public FOUNDATION_1_ESCROW_DURATION = 300 days;

    uint256 constant public FOUNDATION_2_ESCROW_SHARE = 450000000000000000000000000;
    uint256 constant public FOUNDATION_2_ESCROW_CLIFF = 30 days;
    uint256 constant public FOUNDATION_2_ESCROW_DURATION = 540 days;

    uint256 constant public GAME_ESCROW_CLIFF = 30 days;
    uint256 constant public GAME_ESCROW_DURATION = 2555 days;

    uint256 constant public CROWDSALE_ESCROW_CLIFF = 30 days;
    uint256 constant public CROWDSALE_ESCROW_DURATION = 600 days;

    /**
     * Event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    event Received(address, uint256);

    constructor(
        uint256 _rate,
        address payable _wallet,
        ERC20 _token,
        address _foundationFund,
        address _liquidityAndMarketingFund,
        address _gameFund
    )
    {
        require(_rate > 0);
        require(_wallet != address(0));

        foundationFund = _foundationFund;
        liquidityAndMarketingFund = _liquidityAndMarketingFund;
        gameFund = _gameFund;
        totalBeneficiaries = 0;
        rate = _rate;
        token = _token;
        wallet = _wallet;

        /**
        * Network: Binance Smart Chain
        * Aggregator: BNB/USD
        * Address: 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
        */
        /* priceFeed = AggregatorV3Interface(0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE); //mainnet */
        priceFeed = AggregatorV3Interface(0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526); //testnet
    }

    /**
     * Returns the latest price
     */
    function getLatestPrice() public view returns (uint256) {
        (
            uint80 roundID,
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return uint256(price).div(100000000);
    }

    function setOwnerPrice(uint256 _ownerPrice) public onlyOwner {
      if(_ownerPrice == 0 ) {
        ownerPrice = uint256(getLatestPrice());
        priceFlag = false;
      } else {
        ownerPrice = _ownerPrice;
        priceFlag = true;
      }
    }

    /**
     * @param _weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount) internal returns (uint256) {
        if(!priceFlag) {
          ownerPrice = uint256(getLatestPrice());
        }

        uint256 newRate = 0;
        if (CrowdsaleStage.PreICO == stage) {
          newRate = ownerPrice.mul(100);
        } else if (CrowdsaleStage.ICO == stage) {
          newRate = ownerPrice.mul(100).div(3);
        }

        return _weiAmount.mul(newRate);
    }

    /**
     * @dev receive function
     */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @dev fallback function
     */
    fallback() external payable {
        buyTokens(msg.sender);
    }

    /**
     * @param _beneficiary Address performing the token purchase
     */
    function buyTokens(address _beneficiary) public payable whenNotPaused nonReentrant {
        require(CrowdsaleStage.PostICO != stage, "Trying to buy tokens when the PostICO stage is active");

        if (CrowdsaleStage.PreICO == stage) {
            require(totalTokensPurchased < token.totalSupply().div(100).mul(3), "Trying to buy tokens in preICO when all token have been sold");
        } else if (CrowdsaleStage.ICO == stage) {
            require(totalTokensPurchased < token.totalSupply().div(10), "Trying to buy tokens in ICO when all token have been sold");
        }

        uint256 _weiAmount = msg.value;
        uint256 _existingPayment = tokenPayments[_beneficiary];
        uint256 _newPayment = _existingPayment.add(_weiAmount);

        require(_beneficiary != address(0));
        require(_weiAmount != 0);
        require(_newPayment >= investorMinCap && _newPayment <= investorHardCap);

        weiRaised = weiRaised.add(_weiAmount);

        uint256 _tokens = _getTokenAmount(_weiAmount);
        totalTokensPurchased = totalTokensPurchased.add(_tokens);

        uint256 _existingPurchase = tokenPurchases[_beneficiary];
        uint256 _newPurchase = _existingPurchase.add(_tokens);

        emit TokenPurchase(msg.sender, _beneficiary, _weiAmount, _tokens);

        tokenPayments[_beneficiary] = _newPayment;
        tokenPurchases[_beneficiary] = _newPurchase;

        if(_existingPurchase == 0) {
          beneficiaries[totalBeneficiaries] = _beneficiary;
          totalBeneficiaries = totalBeneficiaries.add(1);
        }

        if (CrowdsaleStage.PreICO == stage && totalTokensPurchased >= token.totalSupply().div(100).mul(3)) {
            /* incrementCrowdsaleStage(uint256(CrowdsaleStage.ICO)); */
            _pause();
        } else if (CrowdsaleStage.ICO == stage && totalTokensPurchased >= token.totalSupply().div(10)) {
            /* incrementCrowdsaleStage(uint256(CrowdsaleStage.PostICO)); */
            _pause();
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    /**
    * @dev Returns the amount contributed so far by a sepecific user.
    * @param _beneficiary Address of contributor
    * @return User contribution so far
    */
    function getUserContribution(address _beneficiary) public view returns (uint256) {
        return tokenPayments[_beneficiary];
    }

    /**
    * @dev Allows admin to update the crowdsale stage
    * @param _stage Crowdsale stage
    */
    function incrementCrowdsaleStage(uint256 _stage) public onlyOwner nonReentrant {
        require(CrowdsaleStage.PostICO != stage, "Trying to set stage when the PostICO is active");
        require(uint256(stage) == uint256(_stage.sub(1)), "Trying to set stage incorectly");

        if (uint(CrowdsaleStage.PreICO) == _stage) {
            stage = CrowdsaleStage.PreICO;
            /* if(!priceFlag) {
              ownerPrice = uint256(getLatestPrice());
            }
            rate = ownerPrice.mul(100); */
        } else if (uint(CrowdsaleStage.ICO) == _stage) {
            investorHardCap = 10000000000000000000; // 10 bnb
            stage = CrowdsaleStage.ICO;
            /* if(!priceFlag) {
              ownerPrice = uint256(getLatestPrice());
            }
            rate = ownerPrice.mul(100).div(3); */
        } else if (uint(CrowdsaleStage.PostICO) == _stage) {
            stage = CrowdsaleStage.PostICO;
        }

    }

    /**
    * @dev Allows admin to update the crowdsale rate
    * @param _rate Crowdsale rate
    */
    function updateCrowdsaleRate(uint256 _rate) public onlyOwner nonReentrant {
        require(CrowdsaleStage.PostICO != stage, "Updating rate postICO not allowed.");
        rate = _rate;
    }

    /**
    * @dev Allows admin to update the crowdsale rate
    */
    function updateCrowdsaleHardCap20BNB() public onlyOwner nonReentrant {
        investorHardCap = 20000000000000000000; // 20 bnb
    }

    /**
    * @dev Allows admin to update the crowdsale rate
    */
    function updateCrowdsaleHardCap30BNB() public onlyOwner nonReentrant {
        investorHardCap = 30000000000000000000; // 20 bnb
    }

    /**
     * @dev enables token transfers and escrow creation when ICO is over
    */
    function distributeTokens() public onlyOwner nonReentrant {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");
        require(token.totalSupply() == uint256(5000000000).mul(10 ** 18), "Total supply is not 5 Billion");
        require(tokenDistributionComplete == false, "Token distribution already completed.");

        token.safeTransfer(liquidityAndMarketingFund, LIQUIDITY_AND_MARKETING_SHARE);

        startEscrowTimestamp = block.timestamp;
        foundationEscrow1 = new TokenVesting(
            foundationFund,
            startEscrowTimestamp,
            FOUNDATION_1_ESCROW_CLIFF,
            FOUNDATION_1_ESCROW_DURATION,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(foundationEscrow1), FOUNDATION_1_ESCROW_SHARE);

        foundationEscrow2 = new TokenVesting(
            foundationFund,
            startEscrowTimestamp + FOUNDATION_1_ESCROW_DURATION + 1 days,
            FOUNDATION_2_ESCROW_CLIFF,
            FOUNDATION_2_ESCROW_DURATION,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(foundationEscrow2), FOUNDATION_2_ESCROW_SHARE);

        tokenSaleEscrow = new TokenVestingPool(token, totalTokensPurchased);
        token.safeTransfer(address(tokenSaleEscrow), totalTokensPurchased);
        for (uint256 i = 0; i < totalBeneficiaries; i++) {
            address beneficiary = beneficiaries[i];
            uint256 purchase = tokenPurchases[beneficiary];
            tokenSaleEscrow.addBeneficiary(
                beneficiary,
                startEscrowTimestamp,
                CROWDSALE_ESCROW_CLIFF,
                CROWDSALE_ESCROW_DURATION,
                purchase
            );
        }

        uint256 gameShare = token.totalSupply().sub(totalTokensPurchased);
        gameShare = gameShare.sub(FOUNDATION_1_ESCROW_SHARE);
        gameShare = gameShare.sub(FOUNDATION_2_ESCROW_SHARE);
        gameShare = gameShare.sub(LIQUIDITY_AND_MARKETING_SHARE);

        gameEscrow = new TokenVesting(
            gameFund,
            startEscrowTimestamp,
            GAME_ESCROW_CLIFF,
            GAME_ESCROW_DURATION,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(gameEscrow), gameShare);

        _forwardFunds();
        tokenDistributionComplete = true;
    }

    function getFoundationVestedContract1() public view returns (address) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        return address(foundationEscrow1);
    }

    function getFoundationVestedContract2() public view returns (address) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        return address(foundationEscrow2);
    }

    function getTokenSaleVestedContract(address beneficiary) public view returns (address){
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address[] memory addressTokenSaleEscrow = tokenSaleEscrow.getDistributionContracts(beneficiary);
        return addressTokenSaleEscrow[0];
    }

    function getGameVestedContract() public view returns (address) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        return address(gameEscrow);
    }

    function getFoundationVestedFunds1() public view returns (uint256) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressFoundationEscrow1 = getFoundationVestedContract1();
        return token.balanceOf(addressFoundationEscrow1);
    }

    function getFoundationVestedFunds2() public view returns (uint256) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressFoundationEscrow2 = getFoundationVestedContract2();
        return token.balanceOf(addressFoundationEscrow2);
    }

    function getTokenSaleVestedFunds(address beneficiary) public view returns (uint256){
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressTokenSaleEscrow = getTokenSaleVestedContract(beneficiary);
        return token.balanceOf(addressTokenSaleEscrow);
    }

    function getGameVestedFunds() public view returns (uint256) {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressGameEscrow = getGameVestedContract();
        return token.balanceOf(addressGameEscrow);
    }


    function releaseFoundationVestedFunds1() public {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressFoundationEscrow1 = getFoundationVestedContract1();
        TokenVesting(addressFoundationEscrow1).release(token);
    }

    function releaseFoundationVestedFunds2() public {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressFoundationEscrow2 = getFoundationVestedContract2();
        TokenVesting(addressFoundationEscrow2).release(token);
    }

    function releaseTokenSaleVestedFunds(address beneficiary) public {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressTokenSaleEscrow = getTokenSaleVestedContract(beneficiary);
        TokenVesting(addressTokenSaleEscrow).release(token);
    }

    function releaseGameVestedFunds() public {
        require(tokenDistributionComplete == true, "Tokens have not been distributed yet");

        address addressGameEscrow = getGameVestedContract();
        TokenVesting(addressGameEscrow).release(token);
    }

    /**
     * @dev Determines how ETH is stored/forwarded on purchases.
     */
    function _forwardFunds() public onlyOwner {
        wallet.transfer(weiRaised);
    }

}
