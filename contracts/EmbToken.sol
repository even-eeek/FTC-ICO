pragma solidity 0.4.24;

/* import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol"; */
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract EmbToken is DetailedERC20  {
  using SafeMath for uint256;

  uint256 public supply;
  mapping(address => uint256) public balances;  // corrected
  constructor(
    string  _name,
    string  _symbol,
    uint8 _decimals,
    uint256 _amount
  )
    DetailedERC20(_name, _symbol, _decimals)

  {
    require(_amount > 0, "amount has to be greater than 0");
    uint256 totalSupply_ = _amount.mul(10 ** uint256(_decimals));
    supply = _amount;
    balances[msg.sender] = totalSupply_;
    emit Transfer(address(0), msg.sender, totalSupply_);
  }
}
