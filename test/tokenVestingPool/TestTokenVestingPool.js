const truffleAssert = require('truffle-assertions')

const {
    assertEvent, increaseTime, now, advanceBlock,
} = require('./utils/helpers');

require('chai')
    .use(require('chai-as-promised'))
    .should();


const TokenVestingPool = artifacts.require('TokenVestingPool');
const ERC20Token = artifacts.require('EmbToken.sol');
const TokenVesting = artifacts.require('TokenVesting');

contract('TokenVestingPool', (accounts) => {
    const owner = accounts[0];
    const beneficiary1 = accounts[1];
    const beneficiary2 = accounts[2];
    const newOwner = accounts[3];
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const oneHour = 3600;
    const oneDay = 86400;
    const oneWeek = oneDay * 7;
    const oneMonth = oneDay * 30;

    let token;
    let start;

    before(async () => {
        await advanceBlock();
    });

    beforeEach(async () => {
        start = await now();
        token = await ERC20Token.new("Ember Token", "EMB", 18, 5000000000000000, {from: owner});
    });

    describe('#constructor', () => {
        it('does not create an instance of the contract when the token argument is invalid', async () => {
            await truffleAssert.reverts(TokenVestingPool.new(zeroAddress, 1e12, {from: owner}), "");
        });

        it('does not create an instance of the contract when the total funds are zero', async () => {
            await truffleAssert.reverts(TokenVestingPool.new(token.address, 0, {from: owner}), "");
        });

        it('creates an instance of the contract', async () => {
            const contract = await TokenVestingPool.new(token.address, 1e12, {from: owner}).should.be.fulfilled;
            assert.ok(contract);
        });
    });

    describe('#addBeneficiary', () => {
        let contract;

        beforeEach(async () => {
            contract = await TokenVestingPool.new(token.address, 1e11, {from: owner});

            await token.transfer(contract.address, 1e11);
        });

        it('does not add a beneficiary when the beneficiary is the owner', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(owner, start, oneDay, oneWeek, 1e10, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when the address is invalid', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(zeroAddress, start, oneDay, oneWeek, 1e10, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when the beneficiary is the contract itself', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(contract.address, start, oneDay, oneWeek, 1e10, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when the duration time is lesser than the cliff time', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(beneficiary1, start, oneWeek, oneDay, 1e10, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when the amount of tokens to distribute is more than the total funds', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e12, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when the token balance is not enough', async () => {
            const anotherContract = await TokenVestingPool.new(token.address, 1e11, {from: owner});
            await token.transfer(anotherContract.address, 1e10);

            await truffleAssert.reverts(
                anotherContract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e11, {from: owner}), ""
            );
        });

        it('does not add a beneficiary when amount of tokens is zero', async () => {
            await truffleAssert.reverts(
                contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 0, {from: owner}), ""
            );
        });

        it('adds a beneficiary to the token pool', async () => {
            const tx = await contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e10, {
                from: owner,
            }).should.be.fulfilled;

            assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const {receipt: {status}} = tx;
            assert.equal(status, 1, 'Could not add beneficiary');
        });

        it('adds a beneficiary even if the start date precedes the invocation of this method', async () => {
            const tx = await contract.addBeneficiary(beneficiary1, start - oneWeek, oneDay, oneWeek, 1e10, {
                from: owner,
            }).should.be.fulfilled;
            assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const {receipt: {status}} = tx;
            assert.equal(status, 1, 'Could not add beneficiary');
        });

        it('adds another token vesting contract when the beneficiary exists in the pool', async () => {
            const tx1 = await contract.addBeneficiary(beneficiary1, start - oneWeek, oneDay, oneWeek, 1e10, {
                from: owner,
            }).should.be.fulfilled;
            assertEvent(tx1, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx2 = await contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1.5e10, {
                from: owner,
            }).should.be.fulfilled;
            assertEvent(tx2, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const {receipt: {status}} = tx2;
            assert.equal(status, 1, 'Could not add vesting contract');
        });

        it('new owner adds a beneficiary after transfering ownership', async () => {
            await contract.transferOwnership(newOwner, {from: owner});

            const tx = await contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e10, {
                from: newOwner,
            }).should.be.fulfilled;
            assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const {receipt: {status}} = tx;
            assert.equal(status, 1, 'Could not add beneficiary');
        });

        // it('adds a beneficiary from old owner after transferring ownership to new owner', async () => {
        //   await contract.transferOwnership(newOwner, { from: owner });
        //
        //   const tx = await contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e10, {
        //     from: owner,
        //   }).should.be.rejectedWith(EVMRevert);
        //   assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');
        //
        //   const { receipt: { status } } = tx;
        //   assert.equal(status, 1, 'Could not add beneficiary');
        // });

        it('previous owner cannot add a beneficiary after the new owner claims ownership', async () => {
            await contract.transferOwnership(newOwner, {from: owner});
            await truffleAssert.reverts(
                contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e10, {from: owner}), ""
            );
        });
    });

    describe('#publicAttributes', () => {
        let contract;
        const totalFunds = 100;
        const beneficiaryAmount = 10;

        beforeEach(async () => {
            contract = await TokenVestingPool.new(token.address, totalFunds, {from: owner});
            await token.transfer(contract.address, totalFunds);

            const tx = await contract.addBeneficiary(
                beneficiary1,
                start,
                oneDay,
                oneWeek,
                beneficiaryAmount,
                {
                    from: owner,
                },
            );
            assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');
        });

        it('uses the same token address as passed to the constructor', async () => {
            const tokenAddress = await contract.token();
            assert.equal(tokenAddress, token.address, 'Token address does not match');
        });

        it('does not modify total funds after adding a beneficiary', async () => {
            const funds = await contract.totalFunds();
            assert.equal(funds, totalFunds, 'Total Funds changed');
        });

        it('does updates distributed tokens after adding a beneficiary', async () => {
            const distributedTokens = await contract.distributedTokens();
            assert.equal(distributedTokens, beneficiaryAmount, 'Distributed Tokens is not correct');
        });

        it('does updates beneficiaries list after adding a beneficiary', async () => {
            const beneficiary = await contract.beneficiaries(0);
            assert.equal(beneficiary, beneficiary1, 'Beneficiaries list is not correct');
        });

        it('does updates beneficiary distribution contracts mapping after adding a beneficiary', async () => {
            const contractAddress = await contract.beneficiaryDistributionContracts(beneficiary1, 0);
            const contracts = await contract.getDistributionContracts(beneficiary1);
            const vestingContract = await TokenVesting.at(contractAddress);
            const vestingBeneficiary = await vestingContract.beneficiary();
            assert.equal(contracts.length, 1, 'Distribution contracts list should have one element');
            assert.equal(contractAddress, contracts[0], 'Distribution contracts list should have mapping content');
            assert.equal(vestingBeneficiary, beneficiary1, 'Distribution contract does not belong to beneficiary');
        });
    });

    describe('#getDistributionContracts', () => {
        let contract;

        beforeEach(async () => {
            contract = await TokenVestingPool.new(token.address, 1e12, {from: owner});
            await token.transfer(contract.address, 1e12);
        });

        it('returns the distribution contracts for a given beneficiary', async () => {
            const tx = await contract.addBeneficiary(beneficiary1, start, oneDay, oneDay, 1e10, {from: owner});
            assertEvent(tx, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const contracts = await contract.getDistributionContracts(beneficiary1);
            const firstContract = await contract.beneficiaryDistributionContracts(
                beneficiary1,
                0,
            );
            assert.equal(contracts.length, 1);
            assert.equal(contracts[0], firstContract);
        });

        it('returns an empty array if beneficiary has not been added', async () => {
            const contracts = await contract.getDistributionContracts(beneficiary2);
            assert.equal(contracts.length, 0);
        });

        it('does not return the distribution contracts if beneficiary is not a valid address', async () => {
            await truffleAssert.reverts(contract.getDistributionContracts(zeroAddress), "");
        });
    });

    context('Integration Test', () => {
        let contract;

        beforeEach(async () => {
            contract = await TokenVestingPool.new(token.address, 1e12, {from: owner});
            await token.transfer(contract.address, 1e12);
        });

        it('transfers the corresponding tokens to the beneficiaries', async () => {
            const tx1 = await contract.addBeneficiary(beneficiary1, start, oneDay, oneDay, 1e11, {from: owner});
            assertEvent(tx1, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx2 = await contract.addBeneficiary(beneficiary1, start, oneDay, oneWeek, 1e11, {from: owner});
            assertEvent(tx2, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            await increaseTime(oneDay * 2);

            const contracts = await contract.getDistributionContracts(beneficiary1);
            const vestingContract0 = await TokenVesting.at(contracts[0]);
            const vestingContract1 = await TokenVesting.at(contracts[1]);

            assert.equal(await vestingContract0.revocable(), false, 'TokenVesting contract should not be revocable');
            assert.equal(await vestingContract1.revocable(), false, 'TokenVesting contract should not be revocable');

            const balanceBefore = await token.balanceOf.call(beneficiary1);
            await vestingContract0.release(token.address);
            await vestingContract1.release(token.address);
            const balanceAfter = await token.balanceOf.call(beneficiary1);

            const difference = balanceAfter - balanceBefore;

            // the first is released entirely (1e11 tokens)
            // the second releases one out of seven days (1e11 / 7 ~= 1,428,571 tokens)
            // the third releases one out of seven days (1e11 / 7 ~= 1,428,571 tokens)

            assert.ok(difference > 1.28e11);
        });


        it('transfers the corresponding tokens in a 10%-30%-60% scheme', async () => {
            const tx1 = await contract.addBeneficiary(beneficiary1, start, oneWeek, oneWeek, 1e10, {from: owner});
            assertEvent(tx1, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx2 = await contract.addBeneficiary(beneficiary1, start, oneMonth, oneMonth, 3e10, {from: owner});
            assertEvent(tx2, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx3 = await contract.addBeneficiary(beneficiary1, start, oneMonth * 3, oneMonth * 3, 6e10, {from: owner});
            assertEvent(tx3, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const contracts = await contract.getDistributionContracts(beneficiary1);

            // 1 week
            let tokenVesting = await TokenVesting.at(contracts[0]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneWeek - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            // Travel to the exact moment when the cliff ends.
            await increaseTime(oneHour);
            const balanceBefore = await token.balanceOf.call(beneficiary1);
            await tokenVesting.release(token.address);
            let balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            let difference = balanceAfterCliff - balanceBefore;

            assert.ok(difference === 1e10);

            // 1 month
            tokenVesting = await TokenVesting.at(contracts[1]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneMonth - oneWeek - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            await increaseTime(oneHour);
            await tokenVesting.release(token.address);
            balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            difference = balanceAfterCliff - balanceBefore;
            assert.ok(difference === 4e10);

            // 3 months
            tokenVesting = await TokenVesting.at(contracts[2]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneMonth * 2 - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            await increaseTime(oneHour);
            await tokenVesting.release(token.address);
            balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            difference = balanceAfterCliff - balanceBefore;
            assert.ok(difference === 1e11);
        });

        it('transfers the corresponding tokens in a 33%-33%-33% scheme', async () => {
            contract = await TokenVestingPool.new(token.address, 3e10, {from: owner});
            await token.transfer(contract.address, 3e10);

            const tx1 = await contract.addBeneficiary(beneficiary1, start, oneMonth, oneMonth, 1e10, {from: owner});
            assertEvent(tx1, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx2 = await contract.addBeneficiary(beneficiary1, start, oneMonth * 2, oneMonth * 2, 1e10, {from: owner});
            assertEvent(tx2, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const tx3 = await contract.addBeneficiary(beneficiary1, start, oneMonth * 3, oneMonth * 3, 1e10, {from: owner});
            assertEvent(tx3, 'BeneficiaryAdded', 'Did not emit `BeneficiaryAdded` event');

            const contracts = await contract.getDistributionContracts(beneficiary1);

            // 1 month
            let tokenVesting = await TokenVesting.at(contracts[0]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneMonth - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            // Travel to the exact moment when the cliff ends.
            await increaseTime(oneHour);
            const balanceBefore = await token.balanceOf.call(beneficiary1);
            await tokenVesting.release(token.address);
            let balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            let difference = balanceAfterCliff - balanceBefore;
            assert.ok(difference === 1e10);

            // 2 months
            tokenVesting = await TokenVesting.at(contracts[1]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneMonth - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            await increaseTime(oneHour);
            await tokenVesting.release(token.address);
            balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            difference = balanceAfterCliff - balanceBefore;
            assert.ok(difference === 2e10);

            // 3 months
            tokenVesting = await TokenVesting.at(contracts[2]);
            // Travel to one hour before the cliff period ends.
            await increaseTime(oneMonth - oneHour);

            assert.equal(await tokenVesting.revocable(), false, 'TokenVesting contract should not be revocable');

            await truffleAssert.reverts(tokenVesting.release(token.address), "");

            await increaseTime(oneHour);
            await tokenVesting.release(token.address);
            balanceAfterCliff = await token.balanceOf.call(beneficiary1);

            difference = balanceAfterCliff - balanceBefore;
            assert.ok(difference === 3e10);
        });
    });
});
