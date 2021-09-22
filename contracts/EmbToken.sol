pragma solidity ^0.8.0;

import "./OZ_legacy/DetailedERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract EmbToken is ERC20  {
  using SafeMath for uint256;

  uint256 public supply;
  mapping(address => uint256) public balances;  // corrected
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _amount
  )
    ERC20(_name, _symbol)

  {
    require(_amount > 0, "amount has to be greater than 0");
    uint256 totalSupply_ = _amount.mul(10 ** uint256(_decimals));
    _mint(msg.sender, totalSupply_);
  }
}
