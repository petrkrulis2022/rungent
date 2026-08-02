import { expect } from "chai";
import { ethers } from "hardhat";

describe("LegCommit", () => {
  async function deploy() {
    const [deployerA, deployerB, operatingWallet, prizeEscrow] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LegCommit");
    const legCommit = await Factory.deploy();
    await legCommit.waitForDeployment();
    return { legCommit, deployerA, deployerB, operatingWallet, prizeEscrow };
  }

  const legId = ethers.keccak256(ethers.toUtf8Bytes("teplice-main-square-loop"));
  const rulesHash = ethers.keccak256(ethers.toUtf8Bytes("rules-v1"));

  it("lets any wallet commit a leg and records it as the deployer (no hardcoded admin)", async () => {
    const { legCommit, deployerA, operatingWallet, prizeEscrow } = await deploy();
    const now = Math.floor(Date.now() / 1000);

    await expect(
      legCommit
        .connect(deployerA)
        .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 3600)
    )
      .to.emit(legCommit, "LegCommitted")
      .withArgs(legId, deployerA.address, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 3600);

    const leg = await legCommit.getLeg(legId);
    expect(leg.deployer).to.equal(deployerA.address);
    expect(leg.exists).to.equal(true);
  });

  it("rejects a second commit for the same legId (immutability, even for the same deployer)", async () => {
    const { legCommit, deployerA, operatingWallet, prizeEscrow } = await deploy();
    const now = Math.floor(Date.now() / 1000);
    await legCommit
      .connect(deployerA)
      .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 3600);

    await expect(
      legCommit
        .connect(deployerA)
        .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 7200)
    ).to.be.revertedWithCustomError(legCommit, "LegAlreadyCommitted");
  });

  it("rejects commit from a different wallet once a legId is taken (not even the admin can override)", async () => {
    const { legCommit, deployerA, deployerB, operatingWallet, prizeEscrow } = await deploy();
    const now = Math.floor(Date.now() / 1000);
    await legCommit
      .connect(deployerA)
      .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 3600);

    await expect(
      legCommit
        .connect(deployerB)
        .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now + 3600)
    ).to.be.revertedWithCustomError(legCommit, "LegAlreadyCommitted");
  });

  it("rejects a deadline at or before startAt", async () => {
    const { legCommit, deployerA, operatingWallet, prizeEscrow } = await deploy();
    const now = Math.floor(Date.now() / 1000);
    await expect(
      legCommit
        .connect(deployerA)
        .commit(legId, rulesHash, operatingWallet.address, prizeEscrow.address, now, now)
    ).to.be.revertedWithCustomError(legCommit, "InvalidDeadline");
  });

  it("rejects a zero operatingWallet or prizeEscrow address", async () => {
    const { legCommit, deployerA, prizeEscrow } = await deploy();
    const now = Math.floor(Date.now() / 1000);
    await expect(
      legCommit
        .connect(deployerA)
        .commit(legId, rulesHash, ethers.ZeroAddress, prizeEscrow.address, now, now + 3600)
    ).to.be.revertedWithCustomError(legCommit, "ZeroAddress");
  });
});
