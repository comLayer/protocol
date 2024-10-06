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

    function countMessagesFrom(UserMailbox storage self, address sender) public view returns (uint256) {
        return self.orderedMessageLists[keccak256(abi.encode(sender))].size;
    }

    function markMessageRead(bytes32 messageId) public returns (bool moreMessages) {

    }

    function markMessageReadFrom(UserMailbox storage self, address sender) public {
        LinkedList storage list = self.orderedMessageLists[keccak256(abi.encode(sender))];
        for(;true;) {
            list.removeHead();
            if(list.size==0) break;
        }
    }
}
