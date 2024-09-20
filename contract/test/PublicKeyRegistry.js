const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe.only("PublicKeyRegistry", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const PublicKeyRegistry = await ethers.getContractFactory("PublicKeyRegistry");
    const contract = await PublicKeyRegistry.deploy();

    return { contract, owner, otherAccount };
  }

  it("Deployment smoke", async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const PublicKeyRegistry = await ethers.getContractFactory("PublicKeyRegistry");
    const contract = await PublicKeyRegistry.deploy();

    expect(await contract.isRegistered(owner)).to.equal(false);
  });

  it("Should register when allowed key/algo passed", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const algo = "RSA"
    await expect(contract.register(key,algo))
      .to.emit(contract, "PublicKeyRegistered").withArgs(owner, key, algo);
    expect(await contract.isRegistered(owner)).to.equal(true);
  });

  it("Should revert registeration when allowed wrong key/algo passed", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const ok_key = "0x"+"a0".repeat(36);
    const ok_algo = "RSA"
    const wrong_key = "0x11";
    const wrong_algo = "SOME"

    await expect(contract.register(ok_key, wrong_algo))
      .to.be.revertedWithCustomError(contract, "UnsupportedEncryptionAlgorithm");
    await expect(contract.register(wrong_key, ok_algo))
    .to.be.revertedWithCustomError(contract, "PublicKeyTooShort");
    expect(await contract.isRegistered(owner)).to.equal(false);
  });

  it("Should be allowed to register keys with new algo once the algo introduced", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const newAlgo = "newalgo"

    await expect(contract.register(key, newAlgo))
      .to.be.revertedWithCustomError(contract, "UnsupportedEncryptionAlgorithm");
      
    await contract.addEncryptionAlgorithm(newAlgo);

    await expect(contract.register(key, newAlgo))
    .to.emit(contract, "PublicKeyRegistered").withArgs(owner, key, newAlgo);
  });

  it("Should restrict new algo intro to contract owner only", async function () {
    const { contract, owner, otherAccount} = await loadFixture(deployContractFixture);
    const newAlgo = "newalgo"

    const callAsOwner = contract;
    const callAsNonOwner = contract.connect(otherAccount);
    await expect(callAsNonOwner.addEncryptionAlgorithm(newAlgo))
      .to.be.revertedWithCustomError(contract, "AccessDenied");

    await expect(callAsOwner.addEncryptionAlgorithm(newAlgo)).to.be.ok;
  });
});
