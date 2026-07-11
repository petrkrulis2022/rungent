// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LegCommit
 * @dev Immutably commits the game rules, start time, deadline, operating wallet,
 * and prize escrow address for a given Rungent pursuit run (called a "Leg").
 */
contract LegCommit {
    address public admin;

    struct Leg {
        bytes32 rulesHash;       // keccak256 of {story, start point, end point, skills, window, prize config}
        address operatingWallet; // Rungent spends gas/items from here
        address prizeEscrow;     // PrizeEscrow contract holding the prize
        uint64 startAt;          // Unix timestamp for start
        uint64 deadline;         // Unix timestamp for deadline
        bool committed;          // True once committed
    }

    // legId => Leg details
    mapping(bytes32 => Leg) public legs;

    event LegCommitted(
        bytes32 indexed legId,
        bytes32 indexed rulesHash,
        address operatingWallet,
        address prizeEscrow,
        uint64 startAt,
        uint64 deadline
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Commits a new leg's rules and parameters. Fields are immutable once set.
     */
    function commit(
        bytes32 legId,
        bytes32 rulesHash,
        address op,
        address escrow,
        uint64 startAt,
        uint64 deadline
    ) external onlyAdmin {
        require(!legs[legId].committed, "Leg already committed");
        require(op != address(0), "Invalid operating wallet");
        require(escrow != address(0), "Invalid escrow address");
        require(deadline > startAt, "Deadline must be after start");

        legs[legId] = Leg({
            rulesHash: rulesHash,
            operatingWallet: op,
            prizeEscrow: escrow,
            startAt: startAt,
            deadline: deadline,
            committed: true
        });

        emit LegCommitted(legId, rulesHash, op, escrow, startAt, deadline);
    }
}
