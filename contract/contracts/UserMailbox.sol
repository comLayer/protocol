// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LinkedList, LinkedListInterface} from "./LinkedList.sol";

struct Message {
    address sender;
    uint256 sentAt;
    bytes data;
}
struct UserMailbox {
    mapping (bytes32 => Message) messages;
    mapping (bytes32 => LinkedList) orderedMessageLists;
    uint256 totalMessagesCount;
}

using LinkedListInterface for LinkedList;

error MessageNotFound();

library UserMailboxInterface {
    function writeMessage(UserMailbox storage self, Message memory _msg) public {
        bytes32 msgHash = keccak256(abi.encode(_msg));
        self.messages[msgHash] = _msg;

        LinkedList storage list = self.orderedMessageLists[keccak256(abi.encode(_msg.sender))];
        list.init();
        list.insertTail(msgHash);
    }

    function readMessageFrom(UserMailbox storage self, address sender) public view returns (bytes32, Message storage) {
        LinkedList storage list = self.orderedMessageLists[keccak256(abi.encode(sender))];
        bytes32 valHash = list.getHead();
        return (valHash, self.messages[valHash]);
    }

    function getMessage(UserMailbox storage self, bytes32 msgId) internal view returns (Message storage) {
        Message storage _msg = self.messages[msgId];
        if(_msg.sentAt == 0) {
            revert MessageNotFound();
        }
        return _msg;
    }

    function countMessagesFrom(UserMailbox storage self, address sender) public view returns (uint256) {
        return self.orderedMessageLists[keccak256(abi.encode(sender))].size;
    }

    function markMessageRead(UserMailbox storage self, bytes32 messageId) public returns (bool moreMessages) {
        Message storage _msg = self.messages[messageId];
        LinkedList storage list = self.orderedMessageLists[keccak256(abi.encode(_msg.sender))];
        list.remove(messageId);
        self.messages[messageId].sentAt=0;
        return list.size > 0;
    }
}
