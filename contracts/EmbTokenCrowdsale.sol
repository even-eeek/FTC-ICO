pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './TokenVestingPool.sol';
import "./OZ_legacy/TokenVesting.sol";


contract EmbTokenCrowdsale is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    // The token being sold
    ERC20 public token;

    // Address where funds are collected
    address payable public wallet;

    // How many token units a buyer gets per wei
    uint256 public rate;

    // How many wei have been raised
    uint256 public weiRaised;

    uint256 public investorMinCap = 200000000000000000; // 0.2 ether
    uint256 public investorHardCap = 6000000000000000000; // 6 ether

    mapping(address => uint256) public tokenPurchases;
    mapping(address => uint256) public tokenPayments;
    mapping(uint256 => address) private holders;

    uint256 totalTokensPurchased;
    uint256 totalHolders;

    // Crowdsale Stages
    enum CrowdsaleStage {PreICO, ICO, PostICO}
    CrowdsaleStage public stage = CrowdsaleStage.PreICO;

    TokenVesting foundationEscrow1;
    TokenVesting foundationEscrow2;
    TokenVestingPool tokenSaleEscrow;
    TokenVesting gameEscrow;

    address public liquidityAndMarketingFund;
    address public foundationFund;
    address public gameFund;

    uint256 constant public TOKEN_SALE_LENGTH = 4 weeks;
    uint256 constant public TOKEN_SALE_PERIODS = 20;
    uint256 constant public GAME_PERIOD_LENGTH = 52 weeks;
    uint256 constant public GAME_PERIODS = 7;

    uint256 constant public FCHAIN_FOUNDATION_SHARE_1 = 50000000000000000000000000;
    uint256 constant public FCHAIN_FOUNDATION_PERIOD_LENGTH_1 = 4 weeks;
    uint256 constant public FCHAIN_FOUNDATION_PERIODS_1 = 10;

    uint256 constant public FCHAIN_FOUNDATION_SHARE_2 = 450000000000000000000000000;
    uint256 constant public FCHAIN_FOUNDATION_PERIOD_LENGTH_2 = 4 weeks;
    uint256 constant public FCHAIN_FOUNDATION_PERIODS_2 = 18;

    uint256 constant public LIQUIDITY_AND_MARKETING_SHARE = 500000000000000000000000000;

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
        totalHolders = 0;
        rate = _rate;
        token = _token;
        wallet = _wallet;
    }

    /**
     * @param _weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        return _weiAmount.mul(rate);
    }

    /**
     * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use super to concatenate validations.
     * @param _beneficiary Address performing the token purchase
     * @param _weiAmount Value in wei involved in the purchase
     */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) pure internal {
        require(_beneficiary != address(0));
        require(_weiAmount != 0);
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
     * @dev low level token purchase ***DO NOT OVERRIDE***
     * @param _beneficiary Address performing the token purchase
     */
    function buyTokens(address _beneficiary) public payable whenNotPaused nonReentrant {
        require(CrowdsaleStage.PostICO != stage, "Trying to buy tokens when the PostICO stage is active");

        if (CrowdsaleStage.PreICO == stage) {
            require(totalTokensPurchased < token.totalSupply().div(100).mul(3), "Trying to buy tokens in preICO when all token have been sold");
        } else if (CrowdsaleStage.ICO == stage) {
            require(totalTokensPurchased < token.totalSupply().div(10), "Trying to buy tokens in ICO when all token have been sold");
        }

        uint256 weiAmount = msg.value;

        uint256 _existingPayment = tokenPayments[_beneficiary];
        uint256 _newPayment = _existingPayment.add(weiAmount);

        require(_newPayment >= investorMinCap && _newPayment <= investorHardCap);

        _preValidatePurchase(_beneficiary, weiAmount);
        weiRaised = weiRaised.add(weiAmount);

        uint256 _tokens = _getTokenAmount(weiAmount);
        totalTokensPurchased = totalTokensPurchased.add(_tokens);


        uint256 _existingPurchase = tokenPurchases[_beneficiary];
        uint256 _newPurchase = _existingPurchase.add(_tokens);

        emit TokenPurchase(msg.sender, _beneficiary, weiAmount, _tokens);

        tokenPayments[_beneficiary] = _newPayment;
        tokenPurchases[_beneficiary] = _newPurchase;
        holders[totalHolders] = _beneficiary;
        totalHolders.add(1);

        if (CrowdsaleStage.PreICO == stage && totalTokensPurchased >= token.totalSupply().div(100).mul(3)) {
            incrementCrowdsaleStage(uint256(CrowdsaleStage.ICO));
        } else if (CrowdsaleStage.ICO == stage && totalTokensPurchased >= token.totalSupply().div(10)) {
            incrementCrowdsaleStage(uint256(CrowdsaleStage.PostICO));
        }
    }

    function pause() public payable onlyOwner {
        _pause();
    }

    function unpause() public payable onlyOwner {
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
    function incrementCrowdsaleStage(uint256 _stage) public onlyOwner {
        require(CrowdsaleStage.PostICO != stage, "Trying to set stage when the PostICO is active");
        require(uint256(stage) == uint256(_stage.sub(1)), "Trying to set stage incorectly");

        if (uint(CrowdsaleStage.PreICO) == _stage) {
            stage = CrowdsaleStage.PreICO;
            rate = 45000;
        } else if (uint(CrowdsaleStage.ICO) == _stage) {
            stage = CrowdsaleStage.ICO;
            rate = 15000;
        } else if (uint(CrowdsaleStage.PostICO) == _stage) {
            stage = CrowdsaleStage.PostICO;
        }
    }

    /**
    * @dev Allows admin to update the crowdsale rate
    * @param _rate Crowdsale rate
    */
    function updateCrowdsaleRate(uint256 _rate) public onlyOwner {
        require(CrowdsaleStage.PostICO != stage, "Updating rate postICO not allowed.");
        rate = _rate;
    }

    /**
     * @dev enables token transfers, called when owner calls finalize()
    */
    function distributeTokens() public onlyOwner nonReentrant {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");
        require(token.totalSupply() == uint256(5000000000).mul(10 ** 18));

        token.safeTransfer(liquidityAndMarketingFund, LIQUIDITY_AND_MARKETING_SHARE);

        foundationEscrow1 = new TokenVesting(
            foundationFund,
            block.timestamp,
            30 days,
            300 days,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(foundationEscrow1), FCHAIN_FOUNDATION_SHARE_1);

        foundationEscrow2 = new TokenVesting(
            foundationFund,
            block.timestamp + 300 days,
            1 days,
            540 days,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(foundationEscrow2), FCHAIN_FOUNDATION_SHARE_2);


        tokenSaleEscrow = new TokenVestingPool(token, totalTokensPurchased);
        token.safeTransfer(address(tokenSaleEscrow), totalTokensPurchased);
        for (uint256 i = 0; i < totalHolders; i++) {
            address beneficiary = holders[i];
            uint256 purchase = tokenPurchases[beneficiary];
            tokenSaleEscrow.addBeneficiary(beneficiary, block.timestamp, 30 days, 600 days, purchase);
        }

        uint256 gameShare = token.totalSupply().sub(totalTokensPurchased);
        gameShare = gameShare.sub(FCHAIN_FOUNDATION_SHARE_1);
        gameShare = gameShare.sub(FCHAIN_FOUNDATION_SHARE_2);
        gameShare = gameShare.sub(LIQUIDITY_AND_MARKETING_SHARE);

        gameEscrow = new TokenVesting(
            gameFund,
            block.timestamp,
            30 days,
            2555 days,
            false // TokenVesting cannot be revoked
        );
        token.safeTransfer(address(gameEscrow), gameShare);

        _forwardFunds();
    }

    function getFoundationVestedContract1() public view returns (address) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        return address(foundationEscrow1);
    }

    function getFoundationVestedContract2() public view returns (address) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        return address(foundationEscrow2);
    }

    function getTokenSaleVestedContract(address beneficiary) public view returns (address){
        require(CrowdsaleStage.PostICO == stage, "Trying to call  when PostICO is not active");

        address[] memory addressTokenSaleEscrow = tokenSaleEscrow.getDistributionContracts(beneficiary);
        return addressTokenSaleEscrow[0];
    }

    function getGameVestedContract() public view returns (address) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        return address(gameEscrow);
    }

    function getFoundationVestedFunds1() public view returns (uint256) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        address addressFoundationEscrow1 = getFoundationVestedContract1();
        return token.balanceOf(addressFoundationEscrow1);
    }

    function getFoundationVestedFunds2() public view returns (uint256) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        address addressFoundationEscrow2 = getFoundationVestedContract2();
        return token.balanceOf(addressFoundationEscrow2);
    }

    function getTokenSaleVestedFunds(address beneficiary) public view returns (uint256){
        require(CrowdsaleStage.PostICO == stage, "Trying to call  when PostICO is not active");

        address addressTokenSaleEscrow = getTokenSaleVestedContract(beneficiary);
        return token.balanceOf(addressTokenSaleEscrow);
    }

    function getGameVestedFunds() public view returns (uint256) {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        address addressGameEscrow = getGameVestedContract();
        return token.balanceOf(addressGameEscrow);
    }


    function releaseFoundationVestedFunds1() public {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        address addressFoundationEscrow1 = getFoundationVestedContract1();
        TokenVesting(addressFoundationEscrow1).release(token);
    }

    function releaseFoundationVestedFunds2() public {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

        address addressFoundationEscrow2 = getFoundationVestedContract2();
        TokenVesting(addressFoundationEscrow2).release(token);
    }

    function releaseTokenSaleVestedFunds(address beneficiary) public {
        require(CrowdsaleStage.PostICO == stage, "Trying to call  when PostICO is not active");

        address addressTokenSaleEscrow = getTokenSaleVestedContract(beneficiary);
        TokenVesting(addressTokenSaleEscrow).release(token);
    }

    function releaseGameVestedFunds() public {
        require(CrowdsaleStage.PostICO == stage, "Trying to finalize when PostICO is not active");

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
