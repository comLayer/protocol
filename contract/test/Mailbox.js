const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const mailboxModule = require("../ignition/modules/Mailbox");

describe.only("Mailbox", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, ..._otherAccounts] = await ethers.getSigners();
    const { contract } = await ignition.deploy(mailboxModule);
    const maxMsgCount = await contract.MAX_MESSAGES_PER_MAILBOX();

    const sender = owner, recipient = _otherAccounts[0];
    const otherAccounts = _otherAccounts.slice(1);

    return { contract, sender, recipient, otherAccounts, maxMsgCount };
  }

  async function deployContractFullMailboxFixture() {
    const {contract, sender, recipient, otherAccounts, maxMsgCount} = await loadFixture(deployContractFixture);
    const messages = []
    for(let i=0; i < maxMsgCount; ++i) {
      const msg = "0x" + Number(128+i).toString(16)
      await expect(contract.writeMessage(msg, recipient))
      .to.emit(contract, "MailboxUpdated")
        .withArgs(sender, recipient, i+1, anyValue);
      messages.push(msg);
    }

    return { contract, sender, recipient, otherAccounts, messages };
  }

  it("Deployment smoke", async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const { contract } = await ignition.deploy(mailboxModule);

    expect(await contract.readMessage(otherAccount, 0)).to.include.members(["0x", 0n, false]);
  });

  it("Should provide a message to a recipient when requested", async function () {
    const {contract, sender, recipient, otherAccounts} = await loadFixture(deployContractFixture);

    const someoneNoMessages = otherAccounts[0];
    const callAsSender = contract.connect(sender);
    const callAsRecipient = contract.connect(recipient);
    const callAsSomeoutNoMessages = contract.connect(someoneNoMessages);
    
    const msg = "0xaa"

    await expect(callAsSender.writeMessage(msg, recipient))
    .to.emit(callAsSender, "MailboxUpdated")
      .withArgs(sender, recipient, 1, anyValue);

    expect(await callAsRecipient.readMessage(sender, 0)).to.include.members([msg, false]);
    expect(await callAsRecipient.readMessage(sender, 1)).to.include.members(["0x", 0n, false]);
    expect(await callAsSomeoutNoMessages.readMessage(sender, 0)).to.include.members(["0x", 0n, false]);
    expect(await callAsRecipient.readMessage(someoneNoMessages, 0)).to.include.members(["0x", 0n, false]);
  });

  it("Should allow writing messages until per dialog limit is reached (sender<->recipient)", async function () {
    const {contract, sender, recipient, maxMsgCount} = await loadFixture(deployContractFixture);

    const callAsSender = contract.connect(sender);
    const callAsRecipient = contract.connect(recipient);
    
    for(let msgIndex=0; msgIndex < maxMsgCount; ++msgIndex) {
      const msg = "0x" + Number(128+msgIndex).toString(16)
      await expect(callAsSender.writeMessage(msg, recipient))
      .to.emit(callAsSender, "MailboxUpdated")
        .withArgs(sender, recipient, msgIndex+1, anyValue);
    }
    await expect(callAsSender.writeMessage("0xff", recipient))
      .to.be.revertedWithCustomError(callAsSender, "MailboxIsFull");
  });

  it.skip("Should allow reading messages", async function () {
    const {contract, sender, recipient, messages} = await loadFixture(deployContractFullMailboxFixture);
    
    const callAsRecipient = contract.connect(recipient);
    
    for(let msgIndex=0; msgIndex < messages.length-1; ++msgIndex) {
      expect(await callAsRecipient.readMessage(sender, msgIndex)).to.include.members([messages[msgIndex], true]);
    }
    let msgIndex = messages.length-1;
    expect(await callAsRecipient.readMessage(sender, msgIndex)).to.include.members([messages[msgIndex], false]);
    msgIndex++;
    expect(await callAsRecipient.readMessage(sender, msgIndex)).to.include.members(["0x", 0n, false]);
  });

  it("Should allow clearing the dialog to make space for new messages", async function () {
    const {contract, sender, recipient, messages} = await loadFixture(deployContractFullMailboxFixture);
    
    const callAsSender = contract.connect(sender);
    const callAsRecipient = contract.connect(recipient);
    await expect(callAsSender.writeMessage("0xff", recipient))
      .to.be.revertedWithCustomError(callAsSender, "MailboxIsFull");

    await expect(callAsRecipient.clearMessages(sender))
    .to.emit(callAsRecipient, "MailboxUpdated")
      .withArgs(sender, recipient, 0, anyValue);
      
    for(let i=0; i < messages.length; ++i) {
      const msg = messages[i];
      await expect(callAsSender.writeMessage(msg, recipient))
      .to.emit(callAsSender, "MailboxUpdated")
        .withArgs(sender, recipient, i+1, anyValue);
    }
  });
});
