const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

    // 1. Deploy MockERC20 (acts as USDC on testnet)
    console.log("\n--- Deploying MockERC20 (test USDC) ---");
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddr = await mockUSDC.getAddress();
    console.log("MockERC20 (mUSDC) deployed to:", mockUSDCAddr);

    // 2. Deploy LegCommit
    console.log("\n--- Deploying LegCommit ---");
    const LegCommit = await hre.ethers.getContractFactory("LegCommit");
    const legCommit = await LegCommit.deploy();
    await legCommit.waitForDeployment();
    const legCommitAddr = await legCommit.getAddress();
    console.log("LegCommit deployed to:", legCommitAddr);

    // 3. Deploy PrizeEscrow
    //    Constructor: PrizeEscrow(bytes32 _legId, address _token, address _oracle)
    //    We use a sample legId and deployer as oracle for the demo
    const sampleLegId = hre.ethers.encodeBytes32String("demo-leg-001");
    console.log("\n--- Deploying PrizeEscrow ---");
    const PrizeEscrow = await hre.ethers.getContractFactory("PrizeEscrow");
    const prizeEscrow = await PrizeEscrow.deploy(mockUSDCAddr, deployer.address, sampleLegId);
    await prizeEscrow.waitForDeployment();
    const prizeEscrowAddr = await prizeEscrow.getAddress();
    console.log("PrizeEscrow deployed to:", prizeEscrowAddr);

    // Summary
    console.log("\n========================================");
    console.log("   DEPLOYMENT COMPLETE - SEPOLIA");
    console.log("========================================");
    console.log(`MockERC20 (mUSDC):  ${mockUSDCAddr}`);
    console.log(`LegCommit:          ${legCommitAddr}`);
    console.log(`PrizeEscrow:        ${prizeEscrowAddr}`);
    console.log("========================================");
    console.log("\nAdd these to your client/.env:");
    console.log(`VITE_LEG_COMMIT_ADDR=${legCommitAddr}`);
    console.log(`VITE_PRIZE_ESCROW_ADDR=${prizeEscrowAddr}`);
    console.log(`VITE_MOCK_USDC_ADDR=${mockUSDCAddr}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
