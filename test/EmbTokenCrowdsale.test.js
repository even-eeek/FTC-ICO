import ether from './helpers/ether';
import EVMRevert from './helpers/EVMRevert';
import { increaseTimeTo } from './helpers/increaseTime';
const truffleAssert = require('truffle-assertions')

const { BN } = require('@openzeppelin/test-helpers');

require('chai')
  .use(require('chai-as-promised'))
  .should();

const EmbToken = artifacts.require('EmbToken');
const EmbTokenCrowdsale = artifacts.require('EmbTokenCrowdsale');

contract('EmbTokenCrowdsale', function([_, wallet, investor1, investor2, foundationFund, liquidityAndMarketingFund, gameFund]) {

  beforeEach(async function () {

    const latestBlock = await web3.eth.getBlockNumber();
    var tempLatestTime;// = await web3.eth.getBlock(latestBlock).timestamp;
    await web3.eth.getBlock(latestBlock, function(error, result){
       if(!error) {
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
    this.wallet = wallet;

    this.liquidityAndMarketingFund = liquidityAndMarketingFund;
    this.foundationFund = foundationFund;
    this.gameFund = gameFund;

    // Investor caps
    this.investorMinCap = ether("0.2");
    this.inestorHardCap = ether("6");

    // ICO Stages
    this.preIcoStage = 0;
    this.preIcoRate = 45000;
    this.icoStage = 1;
    this.icoRate = 15000;
    this.postIcoStage = 2;

    this.crowdsale = await EmbTokenCrowdsale.new(
      this.preIcoRate,
      this.wallet,
      this.token.address,
      this.foundationFund,
      this.liquidityAndMarketingFund,
      this.gameFund
    );

     const totalOwnerSupply = await this.token.balanceOf(this.owner)

     // Transfer token to Vesting Address
     await this.token.transfer(this.crowdsale.address, totalOwnerSupply,  { from: this.owner });

     // Transfer token ownership to crowdsale
    await this.token.transferOwnership(this.crowdsale.address);

    // // Advance time to crowdsale start
    await increaseTimeTo(this.openingTime + 1);
  });

  describe('crowdsale', function() {

    it('tracks the rate', async function() {

      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(this.preIcoRate));
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

  describe('crowdsale pause', async function() {
    it("should be able to call pause() by the owner of tokenSale", async function () {
        await this.crowdsale.pause({ from: investor1 }).should.be.rejectedWith(EVMRevert);

        assert.equal(false, await this.crowdsale.paused());
    });

    it("should be able to call unpause() by the owner of tokenSale", async function () {
        await this.crowdsale.pause({ from: this.owner }).should.be.fulfilled;
        assert.equal(true, await this.crowdsale.paused());

        await this.crowdsale.unpause({ from: investor1 }).should.be.rejectedWith(EVMRevert);
        assert.equal(true, await this.crowdsale.paused());

        await this.crowdsale.unpause({ from: this.owner }).should.be.fulfilled;
        assert.equal(false, await this.crowdsale.paused());
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
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(new BN(this.icoStage));
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(this.icoRate));
    });

    it('allows admin to update the stage to PostICO', async function() {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
      const stage = await this.crowdsale.stage();
      stage.should.be.bignumber.equal(new BN(this.postIcoStage));
    });

    it('prevents admin from updating the stage to PreICO when ICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.preIcoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents admin from updating the stage to PreICO when PostICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.preIcoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents admin from updating the stage to ICO when PostICO is active', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

    it('prevents non-admin from updating the stage', async function () {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });


    it('allows admin to update the rate', async function() {
      let newRate = 55000;
      await this.crowdsale.updateCrowdsaleRate(newRate, { from: this.owner });
      const rate = await this.crowdsale.rate();
      rate.should.be.bignumber.equal(new BN(newRate));
    });

    it('prevents non-admin from updating the rate', async function () {
      let newRate = 65000;
      await this.crowdsale.updateCrowdsaleRate(newRate, { from: investor1 }).should.be.rejectedWith(EVMRevert);
    });

  });

  describe('accepting payments', function() {
    it('should accept payments', async function() {
      const value = ether('1');
      const purchaser = investor2;
      await this.crowdsale.sendTransaction({ from: investor1, value: value  }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { from: purchaser, value: value }).should.be.fulfilled;
    });
  });

  describe('buyTokens()', function() {
    describe('when the contract is paused', function() {
      it('rejects the transaction', async function() {
        await this.crowdsale.pause({ from: this.owner }).should.be.fulfilled;
        assert.equal(true, await this.crowdsale.paused());
        const value =  this.investorMinCap + 1;
        await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.rejectedWith(EVMRevert);
      });
    });

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

  // describe('withdrawal BNB funds to the chosen company wallet', function () {
  //   const value = ether('2');
  //   it('succeeds & updates the contribution amount', async function () {
  //     const walletBalanceBefore = await web3.eth.getBalance(wallet);
  //     console.log("walletBalanceBefore")
  //     console.log(walletBalanceBefore)
  //
  //     await this.crowdsale.buyTokens(investor2, { value: value, from: investor2 }).should.be.fulfilled;
  //     const contribution = await this.crowdsale.getUserContribution(investor2);
  //     contribution.should.be.bignumber.equal(value);
  //
  //     await this.crowdsale._forwardFunds( { from: this.owner }).should.be.fulfilled;
  //
  //     const walletBalanceAfter = await web3.eth.getBalance(wallet);
  //     console.log("walletBalanceAfter")
  //     console.log(walletBalanceAfter)
  //
  //     walletBalanceAfter.should.be.equal(walletBalanceBefore + value);
  //   });
  // });

  describe('finalize', function() {
    it("prevents calling finalize when PreICO is active", async function()  {
      await this.crowdsale.distributeTokens({from: this.owner}).should.be.rejectedWith(EVMRevert);
    });
    it("prevents calling finalize when ICO is active", async function()  {
      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.distributeTokens({from: this.owner}).should.be.rejectedWith(EVMRevert);
    })
    it("allows calling finalize when PostICO is active", async function()  {
      const value = ether('1');
      const purchaser = investor2;
      await this.crowdsale.sendTransaction({ from: investor1, value: value  }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { from: purchaser, value: value }).should.be.fulfilled;

      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });

      await this.crowdsale.distributeTokens({from: this.owner}).should.be.fulfilled;
    })
    it("Does not allow calling distributeTokens twice", async function()  {
      const value = ether('1');
      const purchaser = investor2;
      await this.crowdsale.sendTransaction({ from: investor1, value: value  }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { from: purchaser, value: value }).should.be.fulfilled;

      await this.crowdsale.incrementCrowdsaleStage(this.icoStage, { from: this.owner });
      await this.crowdsale.incrementCrowdsaleStage(this.postIcoStage, { from: this.owner });

      await this.crowdsale.distributeTokens({from: this.owner}).should.be.fulfilled;

      await truffleAssert.reverts(
          this.crowdsale.distributeTokens({from: this.owner}), "Token distribution already completed."
      );
    })
  })
});
