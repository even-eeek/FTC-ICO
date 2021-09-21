import ether from './helpers/ether';
import EVMRevert from './helpers/EVMRevert';
import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';

const { BN } = require('@openzeppelin/test-helpers');

require('chai')
  .use(require('chai-as-promised'))
  .should();

const EmbToken = artifacts.require('EmbToken');
const EmbTokenCrowdsale = artifacts.require('EmbTokenCrowdsale');
// const MultiBeneficiaryTokenVesting = artifacts.require("MultiBeneficiaryTokenVesting");

contract('EmbTokenCrowdsale', function([_, wallet, investor1, investor2, foundationFund, liquidityAndMarketingFund,  gameFund]) {


  before(async function() {
    // Transfer extra ether to investor1's account for testing
    await web3.eth.sendTransaction({ from: _, to: investor1, value: ether('2') })
  });


  beforeEach(async function () {

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

    this.owner = _;

    // Token config
    this.name = "Ember Token";
    this.symbol = "EMB";
    this.decimals = 18;
    this.supply = 5000000000;

    // Deploy Token
    this.token = await EmbToken.new(
      this.name,
      this.symbol,
      this.decimals,
      this.supply
    );

    // Crowdsale config
    this.rate = 45000; //42000 EMB for 1 eth
    this.wallet = wallet;
    // this.cap = ether("100");
    this.cap = ether('11111');

    // this.openingTime = tempLatestTime + duration.weeks(1);
    // this.closingTime = this.openingTime + duration.weeks(1);


    // this.goal = ether("50");
    // this.goal = web3.utils.toWei('50');
    this.liquidityAndMarketingFund = liquidityAndMarketingFund;
    this.foundationFund = foundationFund;
    this.gameFund = gameFund;
    // this.releaseTime  = this.closingTime + duration.years(1);


    // Investor caps
    this.investorMinCap = ether("0.2");
    this.inestorHardCap = ether("6");



    // this.investorMinCap = web3.utils.toWei('0.2');
    // this.inestorHardCap = web3.utils.toWei('6');

    // uint256 public investorMinCap =  200000000000000000; // 0.2 ether
    // uint256 public investorHardCap = 6000000000000000000; // 6 ether

    // ICO Stages
    this.preIcoStage = 0;
    this.preIcoRate = 45000;
    this.icoStage = 1;
    this.icoRate = 15000;
    this.postIcoStage = 2;

    // Token Distribution

    this.tokenSalePercentage                = 10;
    this.foundationPercentage               = 10;
    this.liquidityAndMarketingPercentage    = 10;
    this.gamePercentage                     = 70;

    console.log("token address")
    console.log(this.token.address)


    this.crowdsale = await EmbTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address,
      this.cap,
      // this.openingTime,
      // this.closingTime,
      this.foundationFund,
      this.liquidityAndMarketingFund,
      this.gameFund
      // this.releaseTime
    );


     // let tokenVestingAddress = this.tokenVesting.address;
     const totalOwnerSupply = await this.token.balanceOf(this.owner)

     // Transfer token to Vesting Address
     await this.token.transfer(this.crowdsale.address, totalOwnerSupply,  { from: this.owner });

     // Transfer token ownership to crowdsale
    await this.token.transferOwnership(this.crowdsale.address);
    // await this.tokenVesting.transferOwnership(this.crowdsale.address);

    // // Add investors to whitelist
    // await this.crowdsale.addManyToWhitelist([investor1, investor2]);
    // await this.crowdsale.addToWhitelist(investor1);

    // // Advance time to crowdsale start
    await increaseTimeTo(this.openingTime + 1);

  });

  describe('crowdsale', function() {

    it('tracks the rate', async function() {

      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(this.rate));
    });

    it('tracks the wallet', async function() {
      const wallet = await this.crowdsale.wallet();
      wallet.should.equal(this.wallet);
    });

    it('tracks the token', async function() {
      const token = await this.crowdsale.token();
      token.should.equal(this.token.address);
    });
  });

  //
  describe('capped crowdsale', async function() {
    it('has the correct hard cap', async function() {
      const cap = await this.crowdsale.cap();
      cap.should.be.bignumber.equal(new BN(this.cap));
    });
  });
  //
  // describe('timed crowdsale', function() {
  //   it('is open', async function() {
  //     const isClosed = await this.crowdsale.hasClosed();
  //     isClosed.should.be.false;
  //   });
  // });
  // //
  // describe('whitelisted crowdsale', function() {
  //   it('rejects contributions from non-whitelisted investors', async function() {
  //     const notWhitelisted = _;
  //     await this.crowdsale.buyTokens(notWhitelisted, { value: ether('1'), from: notWhitelisted }).should.be.rejectedWith(EVMRevert);
  //   });
  //
  //   it('accepts contributions from whitelisted investors', async function() {
  //     await this.crowdsale.buyTokens(investor1, { value: ether('1'), from: investor1 }).should.be.fulfilled;
  //   });
  // });

  describe('crowdsale pause', async function() {
    it("should be able to call pauseTokenSale() by the owner of tokenSale", async () => {

        await this.crowdsale.pauseTokenSale({ from: this.investor1 }).should.be.rejectedWith(EVMRevert);

        assert.equal(true, await this.crowdsale.tokenSalePaused());
    });

    it("should be able to call unpauseTokenSale() by the owner of tokenSale", async () => {
        await this.crowdsale.pauseTokenSale({ from: this.owner }).should.be.fulfilled;
        assert.equal(true, await tokenSale.tokenSalePaused());

        await tokenSale.unpauseTokenSale({ from: accounts[0] }).should.be.rejectedWith(EVMRevert);;

        await this.crowdsale.unpauseTokenSale({ from: this.owner }).should.be.fulfilled;
        assert.equal(false, await tokenSale.tokenSalePaused());
    });
  })

  describe('crowdsale stages', function() {

    it('it starts in PreICO', async function () {
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(new BN(this.preIcoStage));
    });

    it('starts at the preICO rate', async function () {
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(this.preIcoRate));
    });

    it('allows admin to update the stage to ICO', async function() {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: _ });
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(new BN(this.icoStage));
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(this.icoRate));
    });

    it('allows admin to update the stage to PostICO', async function() {
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: _ });
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(new BN(this.postIcoStage));
    });

    it('prevents admin from updating the stage to PreICO when ICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: _ });
      await this.crowdsale.incrementCrowdsaleStage(this.preIcoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents admin from updating the stage to PreICO when PostICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: _ });
      await this.crowdsale.incrementCrowdsaleStage(this.preIcoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents admin from updating the stage to ICO when PostICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: _ });
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents non-admin from updating the stage', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });


    it('allows admin to update the rate', async function() {
      let newRate = 55000;
      await this.crowdsale.setCrowdsaleRate(newRate, { from: _ });
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(newRate));
    });

    it('prevents non-admin from updating the rate', async function () {
      let newRate = 65000;
      await this.crowdsale.setCrowdsaleRate(newRate, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

  });

  describe('accepting payments', function() {
    it('should accept payments', async function() {
      const value = ether('1');
      const purchaser = investor2;
      await this.crowdsale.sendTransaction({ value: value, from: investor1 }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { value: value, from: purchaser }).should.be.fulfilled;
    });
  });

  describe('buyTokens()', function() {
    describe('when the contribution is less than the minimum cap', function() {
      it('rejects the transaction', async function() {
        const value =  this.investorMinCap - 100;
        await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.rejectedWith(EVMRevert);
      });
    });
  //
    describe('when the investor has already met the minimum cap', function() {
      it('allows the investor to contribute below the minimum cap', async function() {
        // First contribution is valid
        const value1 = ether('1');
        await this.crowdsale.buyTokens(investor1, { value: value1, from: investor1 });
        // Second contribution is less than investor cap
        const value2 = 1; // wei
        await this.crowdsale.buyTokens(investor1, { value: value2, from: investor1 }).should.be.fulfilled;
      });
    });
  });

  describe('when the total contributions exceed the investor hard cap', function () {
    it('rejects the transaction', async function () {
      // First contribution is in valid range
      const value1 = ether('2');
      await this.crowdsale.buyTokens(investor1, { value: value1, from: investor1 });
      // Second contribution sends total contributions over investor hard cap
      const value2 = ether('5');
      await this.crowdsale.buyTokens(investor1, { value: value2, from: investor1 }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('when the contribution is within the valid range', function () {
    const value = ether('2');
    it('succeeds & updates the contribution amount', async function () {
      await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.fulfilled;
      const contribution = await this.crowdsale.getUserContribution(investor2);
      contribution.should.be.bignumber.equal(value);
    });
  });

  describe('token distribution', function() {
    it('tracks token distribution correctly', async function () {
      const tokenSalePercentage = await this.crowdsale.tokenSalePercentage();
      tokenSalePercentage.should.be.bignumber.eq(new BN(this.tokenSalePercentage), 'has correct tokenSalePercentage');
      const liquidityAndMarketingPercentage = await this.crowdsale.liquidityAndMarketingPercentage();
      liquidityAndMarketingPercentage.should.be.bignumber.eq(new BN(this.liquidityAndMarketingPercentage), 'has correct liquidityAndMarketingPercentage');
      const foundationPercentage = await this.crowdsale.foundationPercentage();
      foundationPercentage.should.be.bignumber.eq(new BN(this.foundationPercentage), 'has correct foundationPercentage');
      const gamePercentage = await this.crowdsale.gamePercentage();
      gamePercentage.should.be.bignumber.eq(new BN(this.gamePercentage), 'has correct gamePercentage');
    });

    it('is a valid percentage breakdown', async function () {
      const tokenSalePercentage = await this.crowdsale.tokenSalePercentage();
      const liquidityAndMarketingPercentage = await this.crowdsale.liquidityAndMarketingPercentage();
      const foundationPercentage = await this.crowdsale.foundationPercentage();
      const gamePercentage = await this.crowdsale.gamePercentage();

      const total = tokenSalePercentage.toNumber() + liquidityAndMarketingPercentage.toNumber() + foundationPercentage.toNumber() + gamePercentage.toNumber()
      total.should.equal(100);
    });
  });

  describe('finalize', function() {
    it("calling finalize when PreICO is active", async function()  {
      await this.crowdsale.finalize({from: this.owner}).should.be.rejectedWith(EVMRevert);
    });
    it("calling finalize when ICO is active", async function()  {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.finalize({from: this.owner}).should.be.rejectedWith(EVMRevert);
    })
    it("calling finalize when PostICO is active", async function()  {
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
      await this.crowdsale.finalize({from: this.owner}).should.be.fulfilled;
    })
  })

  // describe('token Vesting', function() {
  //
  //    it("doesn't release in PostICO before cliff", async function()  {
  //      await this.crowdsale.buyTokens(investor1, { value: ether('1'), from: investor1 })
  //      const investor1Balance = await this.token.balanceOf(investor1);
  //      console.log("investor1Balance")
  //      console.log(investor1Balance)
  //      await this.crowdsale.buyTokens(investor2, { value: ether('1'), from: investor2 })
  //      const investor2Balance = await this.token.balanceOf(investor2);
  //      console.log("investor2Balance")
  //      console.log(investor2Balance)
  //
  //      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
  //      await this.crowdsale.finalize({from: this.owner}).should.be.fulfilled;
  //
  //      increaseTimeTo(duration.days(29));
  //      await this.crowdsale.releaseAllTokens();
  //
  //      investor1Balance.should.be.bignumber.eq(new BN(0), 'investor 1 has correct 0 balance');
  //      investor2Balance.should.be.bignumber.eq(new BN(0), 'investor 2 has correct 0 balance');
  //
  //    });
  //
  //    it("release tokens in PostICO after cliff", async function()  {
  //      await this.crowdsale.buyTokens(investor1, { value: ether('1'), from: investor1 })
  //      const investor1Balance = await this.token.balanceOf(investor1);
  //      console.log("investor1Balance")
  //      console.log(investor1Balance)
  //      await this.crowdsale.buyTokens(investor2, { value: ether('2'), from: investor2 })
  //      const investor2Balance = await this.token.balanceOf(investor2);
  //      console.log("investor2Balance")
  //      console.log(investor2Balance)
  //      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
  //      await this.crowdsale.finalize({from: this.owner}).should.be.fulfilled;
  //
  //      increaseTimeTo(duration.days(31));
  //      await this.crowdsale.releaseAllTokens();
  //      //5% from 45000 (1 eth) = 2250
  //      investor1Balance.should.be.bignumber.eq(new BN(2250), 'investor 1 has correct 0 balance');
  //
  //      //5% from 45000 (2 eth) = 5000
  //      investor2Balance.should.be.bignumber.eq(new BN(5000), 'investor 2 has correct 0 balance');
  //    });
  //
  // });

});
