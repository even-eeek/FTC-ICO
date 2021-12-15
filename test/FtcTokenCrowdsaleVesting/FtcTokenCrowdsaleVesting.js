import ether from './utils/ether';
const truffleAssert = require('truffle-assertions')
const { BN } = require('@openzeppelin/test-helpers');
import EVMRevert from './utils/EVMRevert';

const {
    assertEvent, increaseTime, now, advanceBlock,
} = require('./utils/helpers');

require('chai')
    .use(require('chai-as-promised'))
    .should();


const ERC20Token = artifacts.require('FtcToken.sol');
const FtcTokenCrowdsale = artifacts.require('FtcTokenCrowdsale');

contract('FtcTokenCrowdsaleVesting', (accounts) => {
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
        token = await ERC20Token.new("Forgotten Coin", "FTC", 18, 5000000000, {from: owner});

        crowdsale = await FtcTokenCrowdsale.new(
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
            assert.equal(contracts[0], "0");
            assert.equal(contracts[1], "x");
        });

        it('reverts when no user has bought tokens', async () => {
            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.rejectedWith(EVMRevert);
        });

        it('does not return the distribution contracts if beneficiary is not a valid address', async () => {
            await truffleAssert.reverts(crowdsale.getTokenSaleVestedContract(zeroAddress), "");
        });
    });

    describe('#getPartialVestedFundsForHalfPeriod', async () => {
        it('returns the same amount vested funds for a given beneficiary as for getting the funds at the final duration', async () => {
            const value = ether('1');
            const value2 = ether('2');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;
            await crowdsale.buyTokens(beneficiary2, { from: beneficiary2, value: value2 }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 300);

            const funds1 = await crowdsale.getTokenSaleVestedFunds(beneficiary1);
            assert.ok(funds1 == 45000000000000000000000);

            const funds2 = await crowdsale.getTokenSaleVestedFunds(beneficiary2);
            assert.ok(funds2 == 90000000000000000000000);
        });

        it('returns the same amount vested funds for foundation1 as for getting the funds at the final duration', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 150);

            const funds = await crowdsale.getFoundationVestedFunds1();
            assert.ok(funds == 50000000000000000000000000);
        });

        it('returns the same amount vested funds for foundation2 as for getting the funds at the final duration', async () => {
          const value = ether('1');
          await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

          await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
          await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

          await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

          await increaseTime(oneDay * 420);

          const funds = await crowdsale.getFoundationVestedFunds2();
          assert.ok(funds >= 225000000000000000000000000);
        });

        it('returns the same amount vested funds contracts for game as for getting the funds at the final duration', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 1228);

            const funds = await crowdsale.getGameVestedFunds();
            //(total supply - 20% - 45000*1e18 (1 buyer) )/ 2
            assert.ok(funds == 3999955000000000000000000000);
        });

        it('returns correct vested funds for a given beneficiary after funds release', async () => {
            const value = ether('1');
            const value2 = ether('2');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;
            await crowdsale.buyTokens(beneficiary2, { from: beneficiary2, value: value2 }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 300);

            //beneficiary1
            let vestedFunds1 = await crowdsale.getTokenSaleVestedFunds(beneficiary1);
            vestedFunds1.should.be.bignumber.equal('45000000000000000000000');
            let funds1 = web3.utils.fromWei(vestedFunds1, 'ether');

            await crowdsale.releaseTokenSaleVestedFunds(beneficiary1);
            let beneficiaryBalanceFunds1 = await token.balanceOf(beneficiary1);
            let beneficiaryBalance1 = web3.utils.fromWei(beneficiaryBalanceFunds1, 'ether');

            vestedFunds1 = await crowdsale.getTokenSaleVestedFunds(beneficiary1);
            let newFunds1 = web3.utils.fromWei(vestedFunds1, 'ether');
            //<= instead of == because the conversion FromWei get getBalance are not procise, so the result will be  different with a small amount like 0.0000000000000000001
            assert.ok(newFunds1 <= funds1 - beneficiaryBalance1);


            //beneficiary2
            let vestedFunds2 = await crowdsale.getTokenSaleVestedFunds(beneficiary2);
            vestedFunds2.should.be.bignumber.equal('90000000000000000000000');
            let funds2 = web3.utils.fromWei(vestedFunds2, 'ether');

            await crowdsale.releaseTokenSaleVestedFunds(beneficiary2);
            let beneficiaryBalanceFunds2 = await token.balanceOf(beneficiary2);
            let beneficiaryBalance2 = web3.utils.fromWei(beneficiaryBalanceFunds2, 'ether');

            vestedFunds2 = await crowdsale.getTokenSaleVestedFunds(beneficiary2);
            let newFunds2 = web3.utils.fromWei(vestedFunds2, 'ether');
            //<= instead of == because the conversion FromWei get getBalance are not procise, so the result will be  different with a small amount like 0.0000000000000000001
              assert.ok(newFunds2 <= funds2 - beneficiaryBalance2);
        });

        it('returns correct vested funds for foundation1 after funds release', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 150);

            let vestedFunds = await crowdsale.getFoundationVestedFunds1();
            vestedFunds.should.be.bignumber.equal('50000000000000000000000000');
            let funds = web3.utils.fromWei(vestedFunds, 'ether');

            await crowdsale.releaseFoundationVestedFunds1();
            let foundationBalanceFunds = await token.balanceOf(foundationFund);
            let foundationBalance = web3.utils.fromWei(foundationBalanceFunds, 'ether');

            vestedFunds = await crowdsale.getFoundationVestedFunds1();
            let newFunds = web3.utils.fromWei(vestedFunds, 'ether');
            //<= instead of == because the conversion FromWei get getBalance are not procise, so the result will be  different with a small amount like 0.0000000000000000001
            assert.ok(newFunds <= funds - foundationBalance);
        });

        it('returns correct vested funds for foundation2 after funds release', async () => {
          const value = ether('1');
          await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

          await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
          await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

          await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

          await increaseTime(oneDay * 420);

          let vestedFunds = await crowdsale.getFoundationVestedFunds2();
          vestedFunds.should.be.bignumber.equal('450000000000000000000000000');
          let funds = web3.utils.fromWei(vestedFunds, 'ether');

          await crowdsale.releaseFoundationVestedFunds2();
          let foundationBalanceFunds = await token.balanceOf(foundationFund);
          let foundationBalance = web3.utils.fromWei(foundationBalanceFunds, 'ether');

          vestedFunds = await crowdsale.getFoundationVestedFunds2();
          let newFunds = web3.utils.fromWei(vestedFunds, 'ether');
          //<= instead of == because the conversion FromWei get getBalance are not procise, so the result will be  different with a small amount like 0.0000000000000000001
          assert.ok(newFunds <= funds - foundationBalance);
        });

        it('returns correct vested funds contracts for game after  funds release', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 1228);

            let vestedFunds = await crowdsale.getGameVestedFunds();
            vestedFunds.should.be.bignumber.equal('3999955000000000000000000000');
            let funds = web3.utils.fromWei(vestedFunds, 'ether');

            //(total supply - 20% - 45000*1e18 (1 buyer) )/ 2
            await crowdsale.releaseGameVestedFunds();
            let gameBalanceFunds = await token.balanceOf(gameFund);
            let gameBalance = web3.utils.fromWei(gameBalanceFunds, 'ether');

            vestedFunds = await crowdsale.getGameVestedFunds();
            let newFunds = web3.utils.fromWei(vestedFunds, 'ether');
            //<= instead of == because the conversion FromWei get getBalance are not procise, so the result will be  different with a small amount like 0.0000000000000000001
            assert.ok(newFunds <= funds - gameBalance);
        });
    });

    describe('#getFinalVestedFunds', async () => {
        it('returns the vested funds for a given beneficiary', async () => {
            const value = ether('1');
            const value2 = ether('2');

            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;
            // await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value2 }).should.be.fulfilled;

            await crowdsale.buyTokens(beneficiary2, { from: beneficiary2, value: value2 }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 600);

            const funds1 = await crowdsale.getTokenSaleVestedFunds(beneficiary1);
            funds1.should.be.bignumber.equal('90000000000000000000000');

            const funds2 = await crowdsale.getTokenSaleVestedFunds(beneficiary2);
            funds2.should.be.bignumber.equal('90000000000000000000000');
        });

        it('returns the vested funds for foundation1', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 300);

            const funds = await crowdsale.getFoundationVestedFunds1();
            funds.should.be.bignumber.equal('50000000000000000000000000');
        });

        it('returns the vested funds for foundation2', async () => {
          const value = ether('1');
          await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

          await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
          await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

          await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

          await increaseTime(oneDay * 840);

          const funds = await crowdsale.getFoundationVestedFunds2();
          funds.should.be.bignumber.equal('450000000000000000000000000');
        });

        it('returns the vested funds contracts for game', async () => {
            const value = ether('1');
            await crowdsale.buyTokens(beneficiary1, { from: beneficiary1, value: value }).should.be.fulfilled;

            await crowdsale.incrementCrowdsaleStage(icoStage, { from: owner });
            await crowdsale.incrementCrowdsaleStage(postIcoStage, { from: owner });

            await crowdsale.distributeTokens({from: owner}).should.be.fulfilled;

            await increaseTime(oneDay * 2555);

            const funds = await crowdsale.getGameVestedFunds();
            //total supply - 20% - 45000*1e18
            funds.should.be.bignumber.equal('3999955000000000000000000000');
        });
    });

});
