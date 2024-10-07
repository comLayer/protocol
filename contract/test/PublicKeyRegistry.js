const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("PublicKeyRegistry", function () {
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
    const [owner] = await ethers.getSigners();

    const PublicKeyRegistry = await ethers.getContractFactory("PublicKeyRegistry");
    const contract = await PublicKeyRegistry.deploy();

    expect(await contract.isRegistered(owner)).to.equal(false);
  });

  it("Should register/unregister a supported key when requested", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const algo = "RSA"
    await expect(contract.register(key,algo))
      .to.emit(contract, "PublicKeyRegistered").withArgs(owner, key, algo);
    expect(await contract.isRegistered(owner)).to.equal(true);
    expect(await contract.getPubKey(owner)).to.include.members([key, algo]);

    const timeOneMinAfter = (await time.latest()) + 61;
    await time.increaseTo(timeOneMinAfter);

    await expect(contract.unregister())
      .to.emit(contract, "PublicKeyUnregistered").withArgs(owner);
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
    await expect(contract.getPubKey(owner))
    .to.be.revertedWithCustomError(contract, "NoPublicKeyRegistered");
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

  it("Should deny registering keys with an algo once the algo is removed", async function () {
    const { contract, owner, otherAccount } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const newAlgo = "newalgo"

    await contract.addEncryptionAlgorithm(newAlgo);

    const callAsOwner = contract;
    const callAsAccount1 = callAsOwner;
    const callAsAccount2 = contract.connect(otherAccount);

    await expect(callAsAccount1.register(key, newAlgo))
    .to.emit(callAsAccount1, "PublicKeyRegistered").withArgs(owner, key, newAlgo);

    await callAsOwner.removeEncryptionAlgorithm(newAlgo);

    await expect(callAsAccount2.register(key, newAlgo))
    .to.be.revertedWithCustomError(callAsAccount2, "UnsupportedEncryptionAlgorithm");
    expect(await contract.isRegistered(otherAccount)).to.equal(false);
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

  it("Should restrict register operation rate for a user to 1 per min", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const anotherKey = "0x"+"b0".repeat(36);
    const algo = "RSA"
    await expect(contract.register(key,algo))
      .to.emit(contract, "PublicKeyRegistered").withArgs(owner, key, algo);
    
    await expect(contract.register(key,algo))
      .to.be.revertedWithCustomError(contract, "RateLimitExceeded");

    const nowTimestamp = await time.latest()
    const oneMinLaterTimestamp = nowTimestamp + 60;

    for (var sec of [15, 30, 45, 55]){
      const timestamp = nowTimestamp + sec;
      await time.increaseTo(timestamp);
      await expect(contract.register(anotherKey, algo))
        .to.be.revertedWithCustomError(contract, "RateLimitExceeded");
    }

    await time.increaseTo(oneMinLaterTimestamp);
    await expect(contract.register(anotherKey, algo))
    .to.emit(contract, "PublicKeyRegistered").withArgs(owner, anotherKey, algo);
  });

  it("Should restrict a user from violating operation rate limit by repeating register/unregister calls", async function () {
    const { contract, owner } = await loadFixture(deployContractFixture);
    
    const key = "0x"+"a0".repeat(36);
    const algo = "RSA"
    await expect(contract.register(key,algo))
      .to.emit(contract, "PublicKeyRegistered").withArgs(owner, key, algo);
    
    await expect(contract.unregister())
      .to.be.revertedWithCustomError(contract, "RateLimitExceeded");
  });
});
