require("dotenv").config({ path: require("path").resolve(__dirname, "../client/.env") });
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      // Local dev network
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.rungemt_private_key ? [process.env.rungemt_private_key] : []
    }
  }
};
