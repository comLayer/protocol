// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PublicKeyRegistry
 * @dev A contract for storing and managing public keys linked to Ethereum addresses in comLayer protocol.
 * Users can register or unregister their public keys and retrieve public keys of others.
 */
contract PublicKeyRegistry {

    /// @dev Structure to store public key information.
    struct PublicKeyInfo {
        bytes publicKey;              // User's public key (binary data)
        string encryptionAlgorithm;   // Encryption algorithm (RSA : 0x00)
        uint256 lastRegisteredAt;     // Timestamp of the last registration to prevent spamming
    }

    /// @dev Mapping to link an Ethereum address to its public key information.
    mapping(address => PublicKeyInfo) private publicKeys;

    /// @dev Mapping to link an Ethereum address to its public key information.
    mapping(string => bool) private supportedEncryptionAlgorithms;

    /// account who deployed the contract
    address private owner;

    /// @dev Minimum time required between registering/unregistering operations to prevent spam.
    uint256 constant RATE_LIMIT_TIME = 1 minutes;

    /// @notice Emitted when a user registers a public key.
    /// @param user The address of the user registering the public key.
    /// @param publicKey The public key being registered.
    /// @param encryptionAlgorithm The encryption algorithm used for the public key.
    event PublicKeyRegistered(address indexed user, bytes publicKey, string encryptionAlgorithm);

    /// @notice Emitted when a user unregisters their public key.
    /// @param user The address of the user unregistering the public key.
    event PublicKeyUnregistered(address indexed user);

    // Custom errors
    error PublicKeyTooShort();
    error UnsupportedEncryptionAlgorithm();
    error RateLimitExceeded();
    error NoPublicKeyRegistered();
    error AccessDenied();

    constructor() {
        supportedEncryptionAlgorithms["RSA"] = true;
        owner = msg.sender;
    }

    /**
     * @notice Registers a public key and associated encryption algorithm for the caller.
     * @dev Public key and encryption algorithm must pass basic validation. Rate limit enforced.
     * @param _publicKey The public key to be registered (in bytes format).
     * @param _encryptionAlgorithm The encryption algorithm used for the public key.
     */
    function register(bytes calldata _publicKey, string calldata _encryptionAlgorithm) external {
        _validateKey(_publicKey, _encryptionAlgorithm);

        publicKeys[msg.sender] = PublicKeyInfo({
            publicKey: _publicKey,
            encryptionAlgorithm: _encryptionAlgorithm,
            lastRegisteredAt: block.timestamp
        });

        emit PublicKeyRegistered(msg.sender, _publicKey, _encryptionAlgorithm);
    }

    /**
     * @notice Unregisters the caller's public key.
     * @dev Reverts if no public key is registered for the caller. Rate limit enforced.
     */
    function unregister() external {
        if (bytes(publicKeys[msg.sender].publicKey).length == 0) revert NoPublicKeyRegistered();

        // Rate limiting to prevent spamming
        if (block.timestamp < publicKeys[msg.sender].lastRegisteredAt + RATE_LIMIT_TIME) {
            revert RateLimitExceeded();
        }

        delete publicKeys[msg.sender];

        emit PublicKeyUnregistered(msg.sender);
    }

    /**
     * @notice Retrieves the public key and encryption algorithm for a given user address.
     * @dev Reverts if no public key is found for the specified address.
     * @param _user The address whose public key information is being requested.
     * @return publicKey The public key associated with the user.
     * @return encryptionAlgorithm The encryption algorithm associated with the user's public key.
     */
    function getPubKey(address _user) external view returns (bytes memory publicKey, string memory encryptionAlgorithm) {
        if (bytes(publicKeys[_user].publicKey).length == 0) revert NoPublicKeyRegistered();

        PublicKeyInfo storage info = publicKeys[_user];
        return (info.publicKey, info.encryptionAlgorithm);
    }

    /**
     * @notice Checks if a public key is registered for the given address.
     * @param _user The address to check for a registered public key.
     * @return isAddressRegistered A boolean indicating if the public key exists.
     */
    function isRegistered(address _user) external view returns (bool isAddressRegistered) {
        return bytes(publicKeys[_user].publicKey).length > 0;
    }

    /**
     * @notice Adds new algorithm allowing to register new keys with
     * @param encryptionAlgorithm new algorithm to add
     */
    function addEncryptionAlgorithm(string calldata encryptionAlgorithm) external {
        if (msg.sender != owner) {
            revert AccessDenied();
        }
        supportedEncryptionAlgorithms[encryptionAlgorithm] = true;
    }

    /**
     * @notice Removes a specified algorithm restricting new key registration
     * @param encryptionAlgorithm an algorithm to remove
     */
    function removeEncryptionAlgorithm(string calldata encryptionAlgorithm) external {
        if (msg.sender != owner) {
            revert AccessDenied();
        }
        delete supportedEncryptionAlgorithms[encryptionAlgorithm];
    }

    /**
     * @dev Internal assertion to verify the internal state of the mapping is consistent.
     * In this case, we assert that the length of the stored public key is consistent after registration.
     */
    function _assertConsistency(address user) internal view {
        assert(bytes(publicKeys[user].publicKey).length >= 32); // Assert that public keys are at least 32 bytes
    }

    /**
     * @dev Validate a provided key agains the specified encryption algorithm and op rate limit
     */
    function _validateKey(bytes calldata _publicKey, string calldata _encryptionAlgorithm) internal view {
        if (_publicKey.length < 32) revert PublicKeyTooShort();

        if (!supportedEncryptionAlgorithms[_encryptionAlgorithm]) {
            revert UnsupportedEncryptionAlgorithm();
        }

        // Rate limiting to prevent spamming
        if (block.timestamp < publicKeys[msg.sender].lastRegisteredAt + RATE_LIMIT_TIME) {
            revert RateLimitExceeded();
        }
    }
}