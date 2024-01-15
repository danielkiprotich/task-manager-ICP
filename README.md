# Task Management Smart Contract

This TypeScript code defines a basic task management system on the Internet Computer. This is a CRUD (Create, Read, Update, Delete) Internet computer smart contract for managing tasks, including search, filtering, and status-based retrieval. It also includes some basic authorization checks to ensure that users can only manipulate their own tasks.

## Overview

### 1. Type Definitions

- **Task Type:**

  ```typescript
  type Task = Record<{
    id: string;
    title: string;
    creator: Principal;
    description: string;
    status: string;
    due_in_minutes: bigint;
    updated_at: Opt<nat64>;
    created_date: nat64;
  }>;
  ```

- **TaskPayload Type:**

  ```typescript
  type TaskPayload = Record<{
    title: string;
    description: string;
    due_in_minutes: number;
  }>;
  ```

### 2. Storage

- A stable BTree map (`taskStorage`) is used to store tasks
  
  ```typescript
  const taskStorage = new StableBTreeMap<string, Task>(0, 44, 512);
  ```

### 3. Update Functions

- Update functions modify the state. For example:
  
  ```typescript
  @update
  function addTask(payload: TaskPayload): Result<Task, string> { /* ... */ }
  ```

### 4. Query Functions

- Query functions retrieve data but don't modify the state:
  
  ```typescript
  @query
  function getTasks(): Result<Vec<Task>, string> { /* ... */ }

  @query
  function getTaskById(id: string): Result<Task, string> { /* ... */ }

  @query
  function searchTasks(searchInput: string): Result<Vec<Task>, string> { /* ... */ }

  @query
  function getTasksByStatus(status: string): Result<Vec<Task>, string> { /* ... */ }

  @query
  function getTasksPastDue(): Result<Vec<Task>, string> { /* ... */ }
  ```

### 5. UUID Generation

- A workaround for generating UUIDs using the `uuid` library:
  
  ```typescript
  globalThis.crypto = {
    getRandomValues: () => {
      let array = new Uint8Array(32);
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  };
  ```

### 6. Error Handling

- The `Result` type is used for handling errors and successful results.

### 7. Authorization

- Some functions include authorization checks to ensure that only authorized users can perform certain actions.

### 8. Task Status Management

- Functions are provided to mark a task as completed, update the task status, and retrieve tasks by status.

### 9. Due Date Handling

- The due date is represented in minutes, You could adjust this to hours or days, and there's a function to retrieve tasks past their due date.

### 10. Date and Time

- The `ic.time()` function is used to get the current timestamp.
