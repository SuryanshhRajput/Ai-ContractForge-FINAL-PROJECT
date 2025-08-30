import { ethers } from "hardhat";

async function main() {
  // Get first signer from Hardhat (or your .env private key when running on Sepolia)
  const [deployer] = await ethers.getSigners();

  console.log("Sending transaction from:", deployer.address);

  // Send 0.001 ETH back to yourself
  const tx = await deployer.sendTransaction({
    to: deployer.address,
    value: ethers.parseEther("0.001"),
  });

  console.log("Transaction sent! Hash:", tx.hash);

  const receipt = await tx.wait();
  if (receipt) {
    console.log("✅ Transaction mined in block:", receipt.blockNumber);
  } else {
    console.log("❌ Transaction receipt is null.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
