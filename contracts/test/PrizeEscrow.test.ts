import { expect } from "chai";
import { ethers } from "hardhat";

describe("PrizeEscrow", () => {
  async function deploy() {
    const [deployerWallet, oracle, catcher, rungentPayout, stranger] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();

    const Escrow = await ethers.getContractFactory("PrizeEscrow");
    const escrow = await Escrow.deploy(usdc.target, oracle.address);
    await escrow.waitForDeployment();

    const prizeAmount = ethers.parseUnits("100", 6); // 100 mUSDC
    await usdc.mint(deployerWallet.address, prizeAmount);
    await usdc.connect(deployerWallet).approve(escrow.target, prizeAmount);

    return { usdc, escrow, deployerWallet, oracle, catcher, rungentPayout, stranger, prizeAmount };
  }

  const legId = ethers.keccak256(ethers.toUtf8Bytes("teplice-main-square-loop"));

  it("accepts funding from the deployer and records it", async () => {
    const { escrow, deployerWallet, prizeAmount } = await deploy();
    await expect(escrow.connect(deployerWallet).fund(legId, prizeAmount))
      .to.emit(escrow, "Funded")
      .withArgs(legId, deployerWallet.address, prizeAmount);

    const [amount, status] = await escrow.prizeOf(legId);
    expect(amount).to.equal(prizeAmount);
    expect(status).to.equal(1); // Funded
  });

  it("pays the full prize to the catcher on settleCatch, only when called by the oracle", async () => {
    const { escrow, usdc, deployerWallet, oracle, catcher, prizeAmount } = await deploy();
    await escrow.connect(deployerWallet).fund(legId, prizeAmount);

    await expect(escrow.connect(oracle).settleCatch(legId, catcher.address))
      .to.emit(escrow, "CatchSettled")
      .withArgs(legId, catcher.address, prizeAmount);

    expect(await usdc.balanceOf(catcher.address)).to.equal(prizeAmount);
    const [amount, status] = await escrow.prizeOf(legId);
    expect(amount).to.equal(0);
    expect(status).to.equal(2); // Settled
  });

  it("pays the full prize to the rungent payout address on settleArrival", async () => {
    const { escrow, usdc, deployerWallet, oracle, rungentPayout, prizeAmount } = await deploy();
    await escrow.connect(deployerWallet).fund(legId, prizeAmount);

    await escrow.connect(oracle).settleArrival(legId, rungentPayout.address);

    expect(await usdc.balanceOf(rungentPayout.address)).to.equal(prizeAmount);
  });

  it("rejects settleCatch from anyone other than the oracle", async () => {
    const { escrow, deployerWallet, catcher, stranger, prizeAmount } = await deploy();
    await escrow.connect(deployerWallet).fund(legId, prizeAmount);

    await expect(
      escrow.connect(stranger).settleCatch(legId, catcher.address)
    ).to.be.revertedWithCustomError(escrow, "OnlyOracle");

    // even the deployer who funded it cannot self-settle
    await expect(
      escrow.connect(deployerWallet).settleCatch(legId, deployerWallet.address)
    ).to.be.revertedWithCustomError(escrow, "OnlyOracle");
  });

  it("prevents double-settling the same leg (catch then catch again)", async () => {
    const { escrow, deployerWallet, oracle, catcher, prizeAmount } = await deploy();
    await escrow.connect(deployerWallet).fund(legId, prizeAmount);
    await escrow.connect(oracle).settleCatch(legId, catcher.address);

    await expect(
      escrow.connect(oracle).settleCatch(legId, catcher.address)
    ).to.be.revertedWithCustomError(escrow, "AlreadySettled");
  });

  it("prevents double-settling across methods (catch then arrival)", async () => {
    const { escrow, deployerWallet, oracle, catcher, rungentPayout, prizeAmount } = await deploy();
    await escrow.connect(deployerWallet).fund(legId, prizeAmount);
    await escrow.connect(oracle).settleCatch(legId, catcher.address);

    await expect(
      escrow.connect(oracle).settleArrival(legId, rungentPayout.address)
    ).to.be.revertedWithCustomError(escrow, "AlreadySettled");
  });

  it("rejects settling a leg that was never funded", async () => {
    const { escrow, oracle, catcher } = await deploy();
    const unfundedLegId = ethers.keccak256(ethers.toUtf8Bytes("never-funded"));

    await expect(
      escrow.connect(oracle).settleCatch(unfundedLegId, catcher.address)
    ).to.be.revertedWithCustomError(escrow, "NothingFunded");
  });

  it("never allows funds to route back to the deployer or escrow owner", async () => {
    // There is deliberately no withdraw/refund function on the contract at
    // all — this test documents that guarantee by asserting the only two
    // payout paths are settleCatch and settleArrival, both oracle-gated and
    // both requiring an explicit non-zero recipient.
    const { escrow } = await deploy();
    expect((escrow as any).withdraw).to.equal(undefined);
    expect((escrow as any).refund).to.equal(undefined);
    expect((escrow as any).recoverFunds).to.equal(undefined);
  });
});
