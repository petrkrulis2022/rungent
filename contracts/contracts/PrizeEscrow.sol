// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Interface for standard ERC20 token interactions (such as USDC).
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PrizeEscrow
 * @dev Holds the testnet USDC reward pool for a specific pursuit run. Released
 * only to the catcher or to the Rungent on arrival by the authority of the server oracle.
 */
contract PrizeEscrow {
    address public token;        // USDC token address
    uint256 public amount;       // Total prize pool amount
    address public oracle;       // RUNDOWN server oracle address
    bytes32 public legId;        // Reference to Leg ID in LegCommit
    address public admin;

    enum State { Funded, Caught, Arrived, Settled }
    State public state;

    event FundedAmount(uint256 amount);
    event Settled(bytes32 indexed legId, address indexed to, uint256 amount, State finalState);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can settle");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call");
        _;
    }

    modifier inState(State _state) {
        require(state == _state, "Invalid state transition");
        _;
    }

    constructor(address _token, address _oracle, bytes32 _legId) {
        token = _token;
        oracle = _oracle;
        legId = _legId;
        admin = msg.sender;
    }

    /**
     * @dev Fund the contract with USDC. Requires IERC20(token).approve(address(this), amt) first.
     */
    function fund(uint256 amt) external inState(State.Funded) {
        require(amt > 0, "Amount must be greater than 0");
        
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amt);
        require(success, "Token deposit failed");
        
        amount += amt;
        emit FundedAmount(amt);
    }

    /**
     * @dev Settles the catch. Server oracle attests that a hunter caught the Rungent.
     */
    function settleCatch(address catcher) external onlyOracle inState(State.Funded) {
        require(catcher != address(0), "Invalid catcher address");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No funds to release");

        state = State.Caught;
        bool success = IERC20(token).transfer(catcher, balance);
        require(success, "Token payout failed");

        state = State.Settled;
        emit Settled(legId, catcher, balance, State.Caught);
    }

    /**
     * @dev Settles the arrival. Server oracle attests that Rungent arrived safely.
     */
    function settleArrival(address rungentPayout) external onlyOracle inState(State.Funded) {
        require(rungentPayout != address(0), "Invalid payout address");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No funds to release");

        state = State.Arrived;
        bool success = IERC20(token).transfer(rungentPayout, balance);
        require(success, "Token payout failed");

        state = State.Settled;
        emit Settled(legId, rungentPayout, balance, State.Arrived);
    }

    /**
     * @dev Utility to update the oracle address if service details change.
     */
    function updateOracle(address _newOracle) external onlyAdmin {
        require(_newOracle != address(0), "Invalid oracle address");
        oracle = _newOracle;
    }
}
