// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

bytes32 constant PRE_HEAD_ADDR = keccak256("preHead");
bytes32 constant POST_TAIL_ADDR = keccak256("postTail");

struct Node {
    bytes32 val;
    bytes32 next;
    bytes32 prev;
}
struct LinkedList {
    mapping (bytes32 => Node) nodes;
    uint256 size;
}

library LinkedListInterface {
    function init(LinkedList storage self) public {
        Node storage preHead = self.nodes[PRE_HEAD_ADDR];
        Node storage postTail = self.nodes[POST_TAIL_ADDR];
        if(preHead.next != 0) return;
        preHead.next = POST_TAIL_ADDR;
        postTail.prev = PRE_HEAD_ADDR;
        preHead.val = PRE_HEAD_ADDR;
        postTail.val = POST_TAIL_ADDR;
    }
    function insertTail(LinkedList storage self, bytes32 val) public {
        bool uniqVal = self.nodes[val].next == 0;
        require(uniqVal, "Unique values only !");

        Node storage postTail = self.nodes[POST_TAIL_ADDR];
        Node storage prev = self.nodes[postTail.prev];
        Node memory node = Node(val, prev.next, postTail.prev);
        bytes32 nodeKey = node.val;
        prev.next = nodeKey;
        postTail.prev = nodeKey;
        self.nodes[val] = node;
        self.size += 1;
    }

    function getHead(LinkedList storage self) public view returns (bytes32) {
        require(self.size>0, "no items");
        Node storage preHead = self.nodes[PRE_HEAD_ADDR];
        bytes32 headAddr = preHead.next;
        Node storage head = self.nodes[headAddr];
        return head.val;
    }

    function removeHead(LinkedList storage self) external {
        require(self.size>0, "no items");
        Node storage prev = self.nodes[PRE_HEAD_ADDR];
        bytes32 headAddr = prev.next;
        Node storage head = self.nodes[headAddr];
        Node storage next = self.nodes[head.next];
        prev.next = head.next;
        next.prev = head.prev;
        self.size -= 1;
    }

    function remove(LinkedList storage self, bytes32 val) external {
        require(self.size>0, "no items");
        Node storage node = self.nodes[val];
        Node storage prev = self.nodes[node.prev];
        Node storage next = self.nodes[node.next];
        prev.next = node.next;
        next.prev = node.prev;
        self.size -= 1;
    }
}
