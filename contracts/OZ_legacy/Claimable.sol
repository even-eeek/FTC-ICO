pragma solidity ^0.8.0;


import "@openzeppelin/contracts/access/Ownable.sol";


/**
 * @title Claimable
 * @dev Extension for the Ownable contract, where the ownership needs to be claimed.
 * This allows the new owner to accept the transfer.
 */
contract Claimable is Ownable {
  address public pendingOwner;

  /**
   * @dev Modifier throws if called by any account other than the pendingOwner.
   */
  modifier onlyPendingOwner() {
    require(msg.sender == pendingOwner);
    _;
  }

  /**
   * @dev Allows the current owner to set the pendingOwner address.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) override onlyOwner public {
    pendingOwner = newOwner;
    /* emit OwnershipTransferred(owner(), pendingOwner); */
    super.transferOwnership(newOwner);
  }
}