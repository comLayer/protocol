// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UserMailbox, UserMailboxInterface, Message} from "./UserMailbox.sol";

/**
 * @title Mailbox
 * @dev A contract for intermediate message exchange between parties.
 */
contract Mailbox {
    /// account who deployed the contract
    address private immutable owner;

    /// @dev Per user Mailbox holding all messages sent by different senders
    mapping (address => UserMailbox) mailboxes;

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

    using UserMailboxInterface for UserMailbox;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Writes a messages to a dedicated Mailbox for (sender,recipient)
     * @param message The message to write
     * @param recipient Message recipient address
     */
    function writeMessage(bytes calldata message, address recipient) external {
        UserMailbox storage mailbox = mailboxes[recipient];
        uint256 msgCount = mailbox.countMessagesFrom(msg.sender);
        if (msgCount == MAX_MESSAGES_PER_MAILBOX) revert MailboxIsFull();

        Message memory _msg = Message({
            sender: msg.sender,
            data: message,
            sentAt: block.timestamp
        });
        mailbox.writeMessage(_msg);

        emit MailboxUpdated(msg.sender, recipient, msgCount+1, block.timestamp);
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
        
        UserMailbox storage mailbox = mailboxes[msg.sender];
        uint256 msgCount = mailbox.countMessagesFrom(sender);
        if (msgCount == 0 || msgIndex > 0) {
            bytes memory zero;
            return (zero, 0, false);
        }
        (bytes32 _msgId, Message memory _msg) = mailbox.readMessageFrom(sender);
        data = _msg.data;
        sentAt = _msg.sentAt;
        hasMoreMessages = msgCount>1;
    }

    /**
     * @notice Removes all messages from the specified sender
     * @param sender The sender who messages to remove
     */
    function clearMessages(address sender) external {
        UserMailbox storage mailbox = mailboxes[msg.sender];
        mailbox.markMessageReadFrom(sender);
        emit MailboxUpdated(sender, msg.sender, 0, block.timestamp);
    }

}