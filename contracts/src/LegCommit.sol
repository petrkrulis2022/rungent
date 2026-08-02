// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title LegCommit
/// @notice Permissionless commitment of a RUNDOWN leg's immutable rules.
/// @dev Anyone can commit a leg — the committing address (msg.sender) becomes
///      that leg's deployer. There is no hardcoded admin/owner on this
///      contract by design (spec requirement). Once committed, a legId's
///      fields can never be changed by anyone, including the deployer.
contract LegCommit {
    struct Leg {
        address deployer;
        bytes32 rulesHash;
        address operatingWallet;
        address prizeEscrow;
        uint64 startAt;
        uint64 deadline;
        bool exists;
    }

    mapping(bytes32 => Leg) public legs;

    event LegCommitted(
        bytes32 indexed legId,
        address indexed deployer,
        bytes32 rulesHash,
        address operatingWallet,
        address prizeEscrow,
        uint64 startAt,
        uint64 deadline
    );

    error LegAlreadyCommitted(bytes32 legId);
    error InvalidDeadline();
    error ZeroAddress();

    /// @notice Commit a leg's immutable rules on-chain. Callable by any wallet;
    ///         msg.sender becomes the leg's deployer.
    function commit(
        bytes32 legId,
        bytes32 rulesHash,
        address operatingWallet,
        address prizeEscrow,
        uint64 startAt,
        uint64 deadline
    ) external {
        if (legs[legId].exists) revert LegAlreadyCommitted(legId);
        if (operatingWallet == address(0) || prizeEscrow == address(0)) revert ZeroAddress();
        if (deadline <= startAt) revert InvalidDeadline();

        legs[legId] = Leg({
            deployer: msg.sender,
            rulesHash: rulesHash,
            operatingWallet: operatingWallet,
            prizeEscrow: prizeEscrow,
            startAt: startAt,
            deadline: deadline,
            exists: true
        });

        emit LegCommitted(legId, msg.sender, rulesHash, operatingWallet, prizeEscrow, startAt, deadline);
    }

    function getLeg(bytes32 legId) external view returns (Leg memory) {
        return legs[legId];
    }

    function isCommitted(bytes32 legId) external view returns (bool) {
        return legs[legId].exists;
    }
}
