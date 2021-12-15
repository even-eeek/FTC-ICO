
const FtcToken = artifacts.require('FtcToken');
const { BN } = require('@openzeppelin/test-helpers');


require('chai')
  .should();


contract('FtcToken', accounts => {
  const _name = 'Forgotten Coin';
  const _symbol = 'FTC';
  const _decimals = 18;
  const _supply = 5000000000;

  beforeEach(async function () {
    this.token = await FtcToken.new(_name, _symbol, _decimals, _supply);
  });

  describe('token attributes', function() {
    it('has the correct name', async function() {
      const name = await this.token.name();
      name.should.equal(_name);
    });

    it('has the correct symbol', async function() {
      const symbol = await this.token.symbol();
      symbol.should.equal(_symbol);
    });

    it('has the correct decimals', async function() {
      const decimals = await this.token.decimals();
      decimals.should.be.bignumber.equal(new BN(_decimals));
    });

    it('has the correct supply', async function() {
      const supply = await this.token.totalSupply();
      const newSupply = _supply * Math.pow(10,_decimals);
      supply.should.be.bignumber.equal('5000000000000000000000000000');
    });

  });
});
