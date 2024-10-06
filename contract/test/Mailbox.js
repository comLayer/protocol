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
    expect(await contract.readMessage(otherAccount)).to.include.members(["0x", 0n]);
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

    expect(await callAsRecipient.readMessage(sender)).to.include.members([msg]);
    expect(await callAsSomeoutNoMessages.readMessage(sender)).to.include.members(["0x", 0n]);
    expect(await callAsRecipient.readMessage(someoneNoMessages)).to.include.members(["0x", 0n]);
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

  it("Should provide the next unread message once a message is marked as read", async function () {
    const {contract, sender, recipient, messages} = await loadFixture(deployContractFullMailboxFixture);
    
    const callAsRecipient = contract.connect(recipient);
    let msgIndex=0
    for(; msgIndex < messages.length-1; ++msgIndex) {
      result = await callAsRecipient.readMessage(sender);
      expect(result.getValue("data")).to.be.equal(messages[msgIndex]);
      // demonstrate the same msg is read until is marked as read 
      result = await callAsRecipient.readMessage(sender);
      expect(result.getValue("data")).to.be.equal(messages[msgIndex]);

      let expRemainingMsgCount = messages.length-msgIndex-1;
      await expect(callAsRecipient.markMessageRead(result.getValue("msgId")))
      .to.emit(callAsRecipient, "MailboxUpdated")
      .withArgs(sender, recipient, expRemainingMsgCount, anyValue);
    }
    result = await callAsRecipient.readMessage(sender);
    expect(result.getValue("data")).to.be.equal(messages[msgIndex]);

    await expect(callAsRecipient.markMessageRead(result.getValue("msgId")))
      .to.emit(callAsRecipient, "MailboxUpdated")
      .withArgs(sender, recipient, 0, anyValue);

    expect(await callAsRecipient.readMessage(sender)).to.include.members(["0x", 0n]);
  });

  it("Should allow writing new messages once pending message is read", async function () {
    const {contract, sender, recipient, messages} = await loadFixture(deployContractFullMailboxFixture);
    
    const callAsSender = contract.connect(sender);
    const callAsRecipient = contract.connect(recipient);
    
    // read all messages
    for(let msgIndex=0; msgIndex < messages.length; ++msgIndex) {
      result = await callAsRecipient.readMessage(sender);
      tx = await callAsRecipient.markMessageRead(result.getValue("msgId"));
      await tx.wait();
    }
    
    // verify mailbox empty
    expect(await callAsRecipient.readMessage(sender)).to.include.members(["0x", 0n]);
    
    // check new messages can be added
    let newMessages = messages.slice(2);
    let messagesCount = newMessages.length;
    for(let i=0; i < newMessages.length; ++i) {
      const msg = newMessages[i];
      await expect(callAsSender.writeMessage(msg, recipient))
      .to.emit(callAsSender, "MailboxUpdated")
        .withArgs(sender, recipient, i+1, anyValue);
    }

    // check new messages can be read
    result = await callAsRecipient.readMessage(sender);
    expect(result.getValue("data")).to.be.equal(newMessages[0]);
    await expect(callAsRecipient.markMessageRead(result.getValue("msgId")))
      .to.emit(callAsRecipient, "MailboxUpdated")
      .withArgs(sender, recipient, messagesCount-1, anyValue);

    result = await callAsRecipient.readMessage(sender);
    expect(result.getValue("data")).to.be.equal(newMessages[1]);
    await expect(callAsRecipient.markMessageRead(result.getValue("msgId")))
      .to.emit(callAsRecipient, "MailboxUpdated")
      .withArgs(sender, recipient, messagesCount-2, anyValue);    
  });
});
