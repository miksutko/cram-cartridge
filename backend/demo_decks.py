"""Two built-in cartridges so the game is playable before Snowflake is connected.

Each question is (subtopic_no, page, prompt, [correct, wrong, wrong, wrong], explanation, quote).
The correct choice is always listed first here; the game shuffles choices per fight.
Every quote is copied exactly from its page.
"""

LINKED_LISTS = {
    "deck_id": "demo-linked-lists",
    "name": "Demo: Linked Lists",
    "main_topic": "Linked Lists",
    "subtopics": ["Nodes and pointers", "Insertion and deletion", "Traversal and complexity"],
    "slides": {
        1: "Linked Lists. A linked list is a linear data structure made of nodes. Each node stores a value "
           "and a reference to the next node. Unlike an array, the nodes do not have to sit next to each "
           "other in memory.",
        2: "Nodes and pointers. A node has two fields: data and next. The head pointer refers to the first "
           "node of the list. The last node's next field is null, which marks the end of the list.",
        3: "Singly vs doubly linked. In a singly linked list each node points only to the next node. In a "
           "doubly linked list each node also stores a prev pointer to the node before it, so you can walk "
           "the list backwards.",
        4: "Inserting at the head. To insert at the head: create a new node, set its next to the current "
           "head, then move head to the new node. This takes O(1) time because no other nodes move.",
        5: "Deleting a node. To delete a node in a singly linked list, change the previous node's next to "
           "skip over it. You need a reference to the previous node, so deleting from the middle means "
           "walking the list first.",
        6: "Traversal. To visit every node, start at head and follow next until you reach null. Searching "
           "for a value this way takes O(n) time in the worst case.",
        7: "Linked list vs array. Arrays give O(1) access by index, but a linked list needs O(n) to reach "
           "the i-th node. Linked lists win when you insert and delete at the front often, because arrays "
           "must shift elements.",
    },
    "questions": [
        (1, 1, "What does each node in a singly linked list store?",
         ["A value and a reference to the next node", "Only a value", "A value and its index in the list",
          "A reference to every other node"],
         "A node holds its data plus a next reference that links it to the following node.",
         "Each node stores a value and a reference to the next node."),
        (1, 2, "What does the head pointer refer to?",
         ["The first node of the list", "The last node of the list", "The middle node", "The largest value"],
         "Head is the entry point: every walk of the list starts there.",
         "The head pointer refers to the first node of the list."),
        (1, 2, "How do you know you have reached the end of a linked list?",
         ["The node's next field is null", "The node's value is 0", "The head pointer is null",
          "The index equals the length"],
         "A null next means there is no following node.",
         "The last node's next field is null, which marks the end of the list."),
        (1, 3, "What extra field does a doubly linked list node have?",
         ["A prev pointer to the node before it", "A pointer to the head", "A counter of nodes",
          "A second value field"],
         "The prev pointer is what lets you walk the list backwards.",
         "In a doubly linked list each node also stores a prev pointer to the node before it"),
        (1, 1, "Do the nodes of a linked list have to sit next to each other in memory?",
         ["No, they can be anywhere in memory", "Yes, just like an array", "Only in a doubly linked list",
          "Only the head and the last node do"],
         "Nodes are joined by references, so they can live anywhere in memory.",
         "Unlike an array, the nodes do not have to sit next to each other in memory."),
        (2, 4, "What is the first step to insert a value at the head?",
         ["Create a new node", "Set head to null", "Walk to the end of the list", "Shift every node right"],
         "You need the new node before you can link it in.",
         "To insert at the head: create a new node, set its next to the current head, then move head to the new node."),
        (2, 4, "What is the time complexity of inserting at the head of a linked list?",
         ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
         "Only the new node and head change; no other nodes move.",
         "This takes O(1) time because no other nodes move."),
        (2, 4, "When inserting at the head, what should the new node's next point to?",
         ["The current head", "null", "The last node", "Itself"],
         "Linking to the old head keeps the rest of the list attached.",
         "set its next to the current head"),
        (2, 5, "How do you delete a node from a singly linked list?",
         ["Change the previous node's next to skip over it", "Set the node's value to null",
          "Move head to the deleted node", "Swap it with the last node"],
         "Once nothing points to the node, it is no longer part of the list.",
         "change the previous node's next to skip over it"),
        (2, 5, "Why does deleting from the middle of a singly linked list need a walk first?",
         ["You need a reference to the previous node", "The list must be sorted first",
          "You must count the nodes first", "The nodes must be copied into an array"],
         "Nodes only point forwards, so you must walk to find the one before.",
         "You need a reference to the previous node, so deleting from the middle means walking the list first."),
        (3, 6, "How do you visit every node in a linked list?",
         ["Start at head and follow next until null", "Jump straight to each index",
          "Start at the last node and follow next", "Sort the nodes first"],
         "Traversal always begins at head and stops at the null at the end.",
         "start at head and follow next until you reach null"),
        (3, 6, "What is the worst-case time to search a linked list for a value?",
         ["O(n)", "O(1)", "O(log n)", "O(n log n)"],
         "You may have to check every node before you find it.",
         "Searching for a value this way takes O(n) time in the worst case."),
        (3, 7, "How long does it take to reach the i-th node of a linked list?",
         ["O(n)", "O(1)", "O(log n)", "O(i^2)"],
         "There is no index jump: you follow next pointers one at a time.",
         "a linked list needs O(n) to reach the i-th node"),
        (3, 7, "Which structure gives O(1) access by index?",
         ["An array", "A singly linked list", "A doubly linked list", "Neither of them"],
         "Arrays can compute where element i lives in memory directly.",
         "Arrays give O(1) access by index"),
        (3, 7, "When does a linked list beat an array?",
         ["Frequent inserts and deletes at the front", "Frequent access by index",
          "Binary search on sorted data", "Storing a fixed number of items"],
         "Arrays must shift elements for front changes; linked lists just relink.",
         "Linked lists win when you insert and delete at the front often, because arrays must shift elements."),
    ],
}

STACKS_QUEUES = {
    "deck_id": "demo-stacks-queues",
    "name": "Demo: Stacks and Queues",
    "main_topic": "Stacks and Queues",
    "subtopics": ["Stacks (LIFO)", "Queues (FIFO)", "Implementations"],
    "slides": {
        1: "Stacks and Queues. Stacks and queues are abstract data types that control the order items are "
           "removed in. A stack removes the newest item first. A queue removes the oldest item first.",
        2: "Stacks (LIFO). A stack is Last In, First Out. push adds an item to the top, pop removes the item "
           "from the top, and peek reads the top without removing it.",
        3: "Uses of stacks. The call stack stores function calls so the most recent call returns first. Undo "
           "in an editor and checking balanced brackets also use a stack.",
        4: "Queues (FIFO). A queue is First In, First Out. enqueue adds an item at the back and dequeue "
           "removes the item at the front.",
        5: "Uses of queues. Print jobs, breadth-first search and requests waiting for a server are handled "
           "in arrival order, so they use a queue.",
        6: "Implementations. A stack can be built on an array: push and pop at the end take O(1) time. A "
           "queue built on a plain array is slow to dequeue from the front, so use a linked list with head "
           "and tail pointers or a circular buffer.",
        7: "Circular buffer. A circular buffer stores a queue in a fixed array and wraps the front and back "
           "indexes around to 0 when they reach the end. Both enqueue and dequeue take O(1) time.",
    },
    "questions": [
        (1, 1, "Which item does a stack remove first?",
         ["The newest item", "The oldest item", "The smallest item", "A random item"],
         "Stacks hand back whatever was added most recently.",
         "A stack removes the newest item first."),
        (1, 2, "What does LIFO stand for?",
         ["Last In, First Out", "Last In, Final Out", "List In, First Out", "Linked In, First Out"],
         "The last item pushed is the first one popped.",
         "A stack is Last In, First Out."),
        (1, 2, "What does peek do on a stack?",
         ["Reads the top item without removing it", "Removes the top item", "Adds an item to the top",
          "Reads the bottom item"],
         "peek looks at the top; pop is the one that removes it.",
         "peek reads the top without removing it"),
        (1, 3, "Which of these uses a stack?",
         ["Checking balanced brackets", "Print jobs", "Breadth-first search", "Requests waiting for a server"],
         "Each closing bracket must match the most recent opening one.",
         "Undo in an editor and checking balanced brackets also use a stack."),
        (1, 3, "Why is the call stack a stack?",
         ["The most recent call must return first", "Calls return in the order they were made",
          "It keeps calls sorted by name", "Any call can return at any time"],
         "A function returns before the function that called it.",
         "The call stack stores function calls so the most recent call returns first."),
        (2, 1, "Which item does a queue remove first?",
         ["The oldest item", "The newest item", "The largest item", "The middle item"],
         "Queues serve items in the order they arrived.",
         "A queue removes the oldest item first."),
        (2, 4, "What does FIFO stand for?",
         ["First In, First Out", "First In, Final Out", "Fast In, Fast Out", "Front In, Front Out"],
         "The first item enqueued is the first one dequeued.",
         "A queue is First In, First Out."),
        (2, 4, "Where does enqueue add an item?",
         ["At the back", "At the front", "In the middle", "At a random position"],
         "New items join the back; dequeue takes from the front.",
         "enqueue adds an item at the back"),
        (2, 5, "Which algorithm uses a queue?",
         ["Breadth-first search", "Checking balanced brackets", "Undo in an editor", "The call stack"],
         "BFS visits nodes in the order they were discovered.",
         "Print jobs, breadth-first search and requests waiting for a server are handled in arrival order, so they use a queue."),
        (3, 6, "How fast are push and pop at the end of an array-backed stack?",
         ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
         "Working at the end of the array never moves other elements.",
         "push and pop at the end take O(1) time"),
        (3, 6, "Why is a plain array a poor queue?",
         ["Dequeuing from the front is slow", "It cannot store numbers", "Enqueue is impossible",
          "Arrays have no front"],
         "Removing index 0 means shifting every other element left.",
         "A queue built on a plain array is slow to dequeue from the front"),
        (3, 7, "What does a circular buffer do when an index reaches the end of the array?",
         ["Wraps it around to 0", "Doubles the array", "Throws an error", "Moves every item left"],
         "Wrapping reuses the free slots at the start of the array.",
         "wraps the front and back indexes around to 0 when they reach the end"),
        (3, 7, "How long do enqueue and dequeue take on a circular buffer?",
         ["O(1)", "O(n)", "O(log n)", "It depends on the item"],
         "Only an index moves; no elements are shifted.",
         "Both enqueue and dequeue take O(1) time."),
    ],
}

DEMO_DECKS = [LINKED_LISTS, STACKS_QUEUES]
