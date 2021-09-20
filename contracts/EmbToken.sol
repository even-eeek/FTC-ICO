pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract EmbToken is DetailedERC20, StandardToken, Ownable {

  uint256 public supply;

  constructor(
    string _name,
    string _symbol,
    uint8 _decimals,
    uint256 _amount
  )
    DetailedERC20(_name, _symbol, _decimals)
    public
  {
    require(_amount > 0, "amount has to be greater than 0");
    totalSupply_ = _amount.mul(10 ** uint256(_decimals));
    supply = _amount;
    balances[msg.sender] = totalSupply_;
    emit Transfer(address(0), msg.sender, totalSupply_);
  }
}
