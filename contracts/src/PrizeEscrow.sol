// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PrizeEscrow
/// @notice Holds a leg's testnet USDC prize and pays it out ONLY on
///         instruction from the oracle (our server, for the demo). Funds can
///         only ever leave to a catcher's wallet (settleCatch) or the
///         Rungent's designated payout address (settleArrival) — never back
///         to the deployer or the escrow's own owner. One instance is shared
///         across legs, keyed by legId, so the demo does not need to deploy a
///         fresh contract per leg.
/// @dev "oracle" is a trusted server key for the demo. Production would
///      replace this with a decentralized adjudication mechanism — flagged
///      here rather than silently pretended away.
contract PrizeEscrow {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable oracle;

    enum LegPrizeStatus {
        None,
        Funded,
        Settled
    }

    struct Prize {
        uint256 amount;
        LegPrizeStatus status;
    }

    mapping(bytes32 => Prize) public prizes;

    event Funded(bytes32 indexed legId, address indexed funder, uint256 amount);
    event CatchSettled(bytes32 indexed legId, address indexed catcher, uint256 amount);
    event ArrivalSettled(bytes32 indexed legId, address indexed rungentPayout, uint256 amount);

    error OnlyOracle();
    error AlreadySettled(bytes32 legId);
    error NothingFunded(bytes32 legId);
    error ZeroAmount();
    error ZeroAddress();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert OnlyOracle();
        _;
    }

    constructor(address usdcAddress, address oracleAddress) {
        if (usdcAddress == address(0) || oracleAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
        oracle = oracleAddress;
    }

    /// @notice Fund a leg's prize pool. Callable by the deployer (or anyone);
    ///         the caller must have approved this contract for `amount` first.
    function fund(bytes32 legId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Prize storage p = prizes[legId];
        if (p.status == LegPrizeStatus.Settled) revert AlreadySettled(legId);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        p.amount += amount;
        p.status = LegPrizeStatus.Funded;

        emit Funded(legId, msg.sender, amount);
    }

    /// @notice Pay the full prize to a hunter who caught/shot the Rungent.
    function settleCatch(bytes32 legId, address catcher) external onlyOracle {
        if (catcher == address(0)) revert ZeroAddress();
        Prize storage p = prizes[legId];
        if (p.status != LegPrizeStatus.Funded) {
            if (p.status == LegPrizeStatus.Settled) revert AlreadySettled(legId);
            revert NothingFunded(legId);
        }

        uint256 amount = p.amount;
        p.status = LegPrizeStatus.Settled;
        p.amount = 0;

        usdc.safeTransfer(catcher, amount);
        emit CatchSettled(legId, catcher, amount);
    }

    /// @notice Pay the full prize to the Rungent's designated payout address
    ///         if it reaches the end point uncaught.
    function settleArrival(bytes32 legId, address rungentPayout) external onlyOracle {
        if (rungentPayout == address(0)) revert ZeroAddress();
        Prize storage p = prizes[legId];
        if (p.status != LegPrizeStatus.Funded) {
            if (p.status == LegPrizeStatus.Settled) revert AlreadySettled(legId);
            revert NothingFunded(legId);
        }

        uint256 amount = p.amount;
        p.status = LegPrizeStatus.Settled;
        p.amount = 0;

        usdc.safeTransfer(rungentPayout, amount);
        emit ArrivalSettled(legId, rungentPayout, amount);
    }

    function prizeOf(bytes32 legId) external view returns (uint256 amount, LegPrizeStatus status) {
        Prize storage p = prizes[legId];
        return (p.amount, p.status);
    }
}
