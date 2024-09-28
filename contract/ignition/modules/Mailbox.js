const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MailboxModule", (m) => {
  const contract = m.contract("Mailbox", []);

  return { contract };
});
