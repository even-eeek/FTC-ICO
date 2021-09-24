import ether from './utils/ether';
const truffleAssert = require('truffle-assertions')
const { BN } = require('@openzeppelin/test-helpers');

const {
    assertEvent, increaseTime, now, advanceBlock,
} = require('./utils/helpers');

require('chai')
    .use(require('chai-as-promised'))
    .should();


const ERC20Token = artifacts.require('EmbToken.sol');
const EmbTokenCrowdsale = artifacts.require('EmbTokenCrowdsale');

contract('EmbTokenCrowdsaleVesting', (accounts) => {
    const owner = accounts[0];
    const wallet = accounts[1];
    const foundationFund = accounts[2];
    const liquidityAndMarketingFund = accounts[3];
    const gameFund = accounts[4];
    const newOwner = accounts[5];
    const beneficiary1 = accounts[6];
    const beneficiary2 = accounts[7];
    const beneficiary3 = accounts[8];
    const beneficiary4 = accounts[9];
    const beneficiary5 = accounts[10];
    const beneficiary6 = accounts[11];
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const oneHour = 3600;
    const oneDay = 86400;
    const oneWeek = oneDay * 7;
    const oneMonth = oneDay * 30;

    let crowdsale;
    let token;
    let start;

    let investorMinCap = ether("0.2");
    let inestorHardCap = ether("6");

    let preIcoStage = 0;
    let preIcoRate = 45000;
    let icoStage = 1;
    let icoRate = 15000;
    let postIcoStage = 2;

    before(async () => {
        await advanceBlock();
    });

    beforeEach(async () => {
        start = await now();
        token = await ERC20Token.new("Ember Token", "EMB", 18, 5000000000, {from: owner});

        crowdsale = await EmbTokenCrowdsale.new(
          preIcoRate,
          wallet,
          token.address,
          foundationFund,
          liquidityAndMarketingFund,
          gameFund
        );

        const totalOwnerSupply = await token.balanceOf(owner)

        await token.transfer(crowdsale.address, totalOwnerSupply,  { from: owner });

        await token.transferOwnership(crowdsale.address);

    });

    describe('#getDistributionContracts', async () => {
        let contract;


        it('returns the distribution contracts for a given beneficiary', async () => {
            const value = ether('1');
            const purchaser = beneficiary1;
            await crowdsale.buyTokens(purchaser, { from: purchaser, value: value }).should.be.fulfilled;

            const totalBeneficiaries = await crowdsale.totalBeneficiaries();
            totalBeneficiaries.should.be.bignumber.equal('1');
            const totalTokensPurchased = await crowdsale.totalTokensPurchased();
            totalTokensPurchased.should.be.bignumber.equal('45000000000000000000000');

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });
            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            const contracts = await crowdsale.getTokenSaleVestedContract(beneficiary1);
            console.log("contracts");
            console.log(contracts);
            assert.equal(contracts[0], "0");
            assert.equal(contracts[1], "x");
        });

        it('returns the distribution contracts for foundation1', async () => {
          const value = ether('1');
          const purchaser = beneficiary1;
          await crowdsale.buyTokens(purchaser, { from: purchaser, value: value }).should.be.fulfilled;

          const totalBeneficiaries = await crowdsale.totalBeneficiaries();
          totalBeneficiaries.should.be.bignumber.equal('1');
          const totalTokensPurchased = await crowdsale.totalTokensPurchased();
          totalTokensPurchased.should.be.bignumber.equal('45000000000000000000000');

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            const contracts = await crowdsale.getFoundationVestedContract1();
            console.log("contracts");
            console.log(contracts);
            assert.equal(contracts[0], "0");
            assert.equal(contracts[1], "x");
        });

        it('returns the distribution contracts for foundation2', async () => {
          const value = ether('1');
          const purchaser = beneficiary1;
          await crowdsale.buyTokens(purchaser, { from: purchaser, value: value }).should.be.fulfilled;

          const totalBeneficiaries = await crowdsale.totalBeneficiaries();
          totalBeneficiaries.should.be.bignumber.equal('1');
          const totalTokensPurchased = await crowdsale.totalTokensPurchased();
          totalTokensPurchased.should.be.bignumber.equal('45000000000000000000000');

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            const contracts = await crowdsale.getFoundationVestedContract2();
            console.log("contracts");
            console.log(contracts);
            assert.equal(contracts[0], "0");
            assert.equal(contracts[1], "x");
        });

        it('returns the distribution contracts for game', async () => {
          const value = ether('1');
          const purchaser = beneficiary1;
          await crowdsale.buyTokens(purchaser, { from: purchaser, value: value }).should.be.fulfilled;

          const totalBeneficiaries = await crowdsale.totalBeneficiaries();
          totalBeneficiaries.should.be.bignumber.equal('1');
          const totalTokensPurchased = await crowdsale.totalTokensPurchased();
          totalTokensPurchased.should.be.bignumber.equal('45000000000000000000000');

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            const contracts = await crowdsale.getGameVestedContract();
            console.log("contracts");
            console.log(contracts);
            assert.equal(contracts[0], "0");
            assert.equal(contracts[1], "x");
        });

        it('does not return the distribution contracts if beneficiary is not a valid address', async () => {
            await truffleAssert.reverts(crowdsale.getTokenSaleVestedContract(zeroAddress), "");
        });
    });
});
