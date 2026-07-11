import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";
import { sepolia, localhost } from "viem/chains";

// ABI definitions for LegCommit and PrizeEscrow. Built exactly to contract layouts.
export const LEG_COMMIT_ABI = parseAbi([
    "function commit(bytes32 legId, bytes32 rulesHash, address op, address escrow, uint64 startAt, uint64 deadline) external",
    "function legs(bytes32 legId) external view returns (bytes32 rulesHash, address operatingWallet, address prizeEscrow, uint64 startAt, uint64 deadline, bool committed)",
    "event LegCommitted(bytes32 indexed legId, bytes32 indexed rulesHash, address operatingWallet, address prizeEscrow, uint64 startAt, uint64 deadline)"
]);

export const PRIZE_ESCROW_ABI = parseAbi([
    "function fund(uint256 amt) external",
    "function settleCatch(address catcher) external",
    "function settleArrival(address rungentPayout) external",
    "function amount() external view returns (uint256)",
    "function state() external view returns (uint8)",
    "event FundedAmount(uint256 amount)",
    "event Settled(bytes32 indexed legId, address indexed to, uint256 amount, uint8 finalState)"
]);

// Contract Addresses (Must be replaced by actual deployment values on Sepolia/Localhost)
export const LEG_COMMIT_ADDRESS = import.meta.env.VITE_LEG_COMMIT_ADDR || "0x0000000000000000000000000000000000000000";

let walletClient = null;
let publicClient = null;

// InitializeClients handles checking for window.ethereum injectors
const initClients = () => {
    const isWeb3Enabled = typeof window !== "undefined" && typeof window.ethereum !== "undefined";
    const useLocal = import.meta.env.VITE_USE_LOCAL_CHAIN === "true";
    const chain = useLocal ? localhost : sepolia;

    publicClient = createPublicClient({
        chain,
        transport: http()
    });

    if (isWeb3Enabled) {
        walletClient = createWalletClient({
            chain,
            transport: custom(window.ethereum)
        });
    }
};

export const connectWallet = async () => {
    initClients();
    if (!walletClient) {
        throw new Error("No ethereum wallet extension detected. Please install MetaMask.");
    }

    const [address] = await walletClient.requestAddresses();
    return address;
};

/**
 * Commits a Leg on-chain via LegCommit contract transaction
 */
export const commitLegOnChain = async (legId, rulesHash, opWallet, escrowAddr, startAt, deadline) => {
    initClients();
    if (!walletClient) throw new Error("Wallet not connected");

    const [address] = await walletClient.getAddresses();

    const { request } = await publicClient.simulateContract({
        account: address,
        address: LEG_COMMIT_ADDRESS,
        abi: LEG_COMMIT_ABI,
        functionName: "commit",
        args: [legId, rulesHash, opWallet, escrowAddr, BigInt(startAt), BigInt(deadline)]
    });

    const txHash = await walletClient.writeContract(request);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
};

/**
 * Submit check-in captured coordinates for token payment releases
 */
export const fundEscrowContract = async (escrowAddr, usdcAmount, usdcAddr) => {
    initClients();
    if (!walletClient) throw new Error("Wallet not connected");

    const [address] = await walletClient.getAddresses();

    // 1. Mock USDC ERC20 Approval
    const erc20Abi = parseAbi(["function approve(address spender, uint256 value) external returns (bool)"]);
    const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: usdcAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [escrowAddr, BigInt(usdcAmount)]
    });
    const approveTx = await walletClient.writeContract(approveRequest);
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // 2. Fund PrizeEscrow
    const { request: fundRequest } = await publicClient.simulateContract({
        account: address,
        address: escrowAddr,
        abi: PRIZE_ESCROW_ABI,
        functionName: "fund",
        args: [BigInt(usdcAmount)]
    });
    const fundTx = await walletClient.writeContract(fundRequest);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: fundTx });

    return { txHash: fundTx, receipt };
};
