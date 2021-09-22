pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DetailedERC20 {// is ERC20 {
  string public  name;
  string public  symbol;
  uint8 public decimals;

  constructor(string memory _name, string memory _symbol, uint8 _decimals)  {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
  }
}
