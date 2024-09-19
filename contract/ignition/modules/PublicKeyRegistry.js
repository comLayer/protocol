const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PublicKeyRegistryModule", (m) => {
  const contract = m.contract("PublicKeyRegistry", []);

  return { contract };
});
