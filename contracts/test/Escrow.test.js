const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Rundown Pursuits Smart Contracts", function () {
    let LegCommit, legCommit;
    let PrizeEscrow, prizeEscrow;
    let MockERC20, usdc;
    let owner, oracle, user1, user2;
    const legId = ethers.encodeBytes32String("leg_1");
    const rulesHash = ethers.keccak256(ethers.toUtf8Bytes("rules_story_start_end"));

    beforeEach(async function () {
        [owner, oracle, user1, user2] = await ethers.getSigners();

        // Deploy Mock USDC
        MockERC20 = await ethers.getContractFactory("MockERC20");
        usdc = await MockERC20.deploy();
        await usdc.waitForDeployment();

        // Deploy LegCommit
        LegCommit = await ethers.getContractFactory("LegCommit");
        legCommit = await LegCommit.deploy();
        await legCommit.waitForDeployment();

        // Deploy PrizeEscrow
        PrizeEscrow = await ethers.getContractFactory("PrizeEscrow");
        prizeEscrow = await PrizeEscrow.deploy(await usdc.getAddress(), oracle.address, legId);
        await prizeEscrow.waitForDeployment();
    });

    describe("LegCommit", function () {
        it("Should allow admin to commit a Leg", async function () {
            const opWallet = user1.address;
            const startAt = Math.floor(Date.now() / 1000);
            const deadline = startAt + 86400 * 7; // 7 days

            await expect(
                legCommit.commit(
                    legId,
                    rulesHash,
                    opWallet,
                    await prizeEscrow.getAddress(),
                    startAt,
                    deadline
                )
            )
                .to.emit(legCommit, "LegCommitted")
                .withArgs(
                    legId,
                    rulesHash,
                    opWallet,
                    await prizeEscrow.getAddress(),
                    startAt,
                    deadline
                );

            const legData = await legCommit.legs(legId);
            expect(legData.rulesHash).to.equal(rulesHash);
            expect(legData.committed).to.be.true;
        });

        it("Should reject commits for already committed Legs", async function () {
            const startAt = Math.floor(Date.now() / 1000);
            const deadline = startAt + 1000;

            await legCommit.commit(
                legId,
                rulesHash,
                user1.address,
                await prizeEscrow.getAddress(),
                startAt,
                deadline
            );

            await expect(
                legCommit.commit(
                    legId,
                    rulesHash,
                    user1.address,
                    await prizeEscrow.getAddress(),
                    startAt,
                    deadline
                )
            ).to.be.revertedWith("Leg already committed");
        });
    });

    describe("PrizeEscrow", function () {
        const fundingAmount = 100 * 10 ** 6; // 100 USDC

        beforeEach(async function () {
            // Approve and Fund the Escrow
            await usdc.approve(await prizeEscrow.getAddress(), fundingAmount);
            await prizeEscrow.fund(fundingAmount);
        });

        it("Should verify Escrow funding", async function () {
            expect(await usdc.balanceOf(await prizeEscrow.getAddress())).to.equal(fundingAmount);
            expect(await prizeEscrow.amount()).to.equal(fundingAmount);
        });

        it("Should release escrow to the catcher on settleCatch", async function () {
            const catcher = user2.address;

            // Oracle settles the catch
            await expect(prizeEscrow.connect(oracle).settleCatch(catcher))
                .to.emit(prizeEscrow, "Settled")
                .withArgs(legId, catcher, fundingAmount, 1); // 1 = State.Caught

            expect(await usdc.balanceOf(catcher)).to.equal(fundingAmount);
            expect(await usdc.balanceOf(await prizeEscrow.getAddress())).to.equal(0);
        });

        it("Should release escrow to the Rungent on settleArrival", async function () {
            const rungentPayout = user1.address;

            // Oracle settles the arrival
            await expect(prizeEscrow.connect(oracle).settleArrival(rungentPayout))
                .to.emit(prizeEscrow, "Settled")
                .withArgs(legId, rungentPayout, fundingAmount, 2); // 2 = State.Arrived

            expect(await usdc.balanceOf(rungentPayout)).to.equal(fundingAmount);
            expect(await usdc.balanceOf(await prizeEscrow.getAddress())).to.equal(0);
        });

        it("Should reject settlements from non-oracle sender", async function () {
            await expect(
                prizeEscrow.connect(user1).settleCatch(user2.address)
            ).to.be.revertedWith("Only oracle can settle");
        });
    });
});
