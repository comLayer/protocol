const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");


const userMailboxModule = buildModule("UserMailboxModule", (m) => {
  const linkedList = m.library("LinkedListInterface");
  const userMailbox = m.contract("UserMailboxInterface", [], {
    libraries: {
      LinkedListInterface: linkedList,
    }
  });

  return { userMailbox };
});

module.exports = buildModule("MailboxModule", (m) => {
  const {userMailbox} = m.useModule(userMailboxModule);
  const contract = m.contract("Mailbox", [], {
    libraries: {
      UserMailboxInterface: userMailbox
    }
  });

  return { contract };
});
