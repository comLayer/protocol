// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Mailbox
 * @dev A contract for intermediate message exchange between parties.
 */
contract Mailbox {

    /// @dev Structure to keep a message for a recipient
    struct Message {
        address sender;
        bytes data;
        uint256 sentAt;
    }

    /// @dev Mapping to link an address pair(sender,recipient) to messages Mailbox
    mapping(bytes32 => Message[]) private messages;

    /// account who deployed the contract
    address private immutable owner;

    /// @dev Max number of messages allowed for a single Mailbox
    uint256 constant public MAX_MESSAGES_PER_MAILBOX = 10;

    /// @notice Emitted when a user writes a message
    /// @param sender The address of the message sender
    /// @param recipient The address of the message recipient
    /// @param messagesCount Total number of messages in the Mailbox for (sender,recipient)
    /// @param timestamp Time when operation occurred
    event MailboxUpdated(address indexed sender, address indexed recipient, uint messagesCount, uint256 timestamp);

    // Raised on attemt to write a messages to a full Mailbox
    error MailboxIsFull();

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Writes a messages to a dedicated Mailbox for (sender,recipient)
     * @param message The message to write
     * @param recipient Message recipient address
     */
    function writeMessage(bytes calldata message, address recipient) external {
        bytes32 msgCellId = _getMailboxAddress(msg.sender, recipient);
        Message[] storage _messages = messages[msgCellId];
        if (_messages.length == MAX_MESSAGES_PER_MAILBOX) revert MailboxIsFull();
        _messages.push(
            Message({
                sender: msg.sender,
                data: message,
                sentAt: block.timestamp
            })
        );

        emit MailboxUpdated(msg.sender, recipient, _messages.length, block.timestamp);
    }

    /**
     * @notice Provides a message to its recipient
     * @param sender Sender address
     * @param msgIndex Index of the message to receive. Recipient is to increment it each call starting from 0 until hasMoreMessages=false
     * @return data The message
     * @return sentAt Timestamp when the message was written
     * @return hasMoreMessages whether there are more messages to read
     */
    function readMessage(address sender, uint8 msgIndex) external view
        returns (bytes memory data, uint256 sentAt, bool hasMoreMessages) {
        bytes32 msgCellId = _getMailboxAddress(sender, msg.sender);
        Message[] storage _messages = messages[msgCellId];
        if (msgIndex < _messages.length) {
            Message memory _msg = _messages[msgIndex];
            data = _msg.data;
            sentAt = _msg.sentAt;
            hasMoreMessages = msgIndex+1 < _messages.length;
        }
    }

    /**
     * @notice Removes all messages from the specified sender
     * @param sender The sender who messages to remove
     */
    function clearMessages(address sender) external {
        delete messages[_getMailboxAddress(sender, msg.sender)];
        emit MailboxUpdated(sender, msg.sender, 0, block.timestamp);
    }

    function _getMailboxAddress(address sender, address recipient) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(sender, recipient));
    }

}