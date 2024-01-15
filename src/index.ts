import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type Task = Record<{
  id: string;
  title: string;
  creator: Principal;
  description: string;
  status: string;
  due_in_minutes: bigint; //  used minutes for testing, can be changed to days or hours
  updated_at: Opt<nat64>;
  created_date: nat64;
}>;

type TaskPayload = Record<{
  title: string;
  description: string;
  due_in_minutes: number;
}>;

type TaskStatusPayload = Record<{
  id: string;
  statusUpdate: string;
}>;

const taskStorage = new StableBTreeMap<string, Task>(0, 44, 512);

// Allows one to add a Task
$update;
export function addTask(payload: TaskPayload): Result<Task, string> {
  // Validate input data
  if (!payload.title || !payload.description || !payload.due_in_minutes) {
    return Result.Err<Task, string>("Missing or invalid input data");
  }

  try {
    const newTask: Task = {
      id: uuidv4(),
      title: payload.title,
      creator: ic.caller(),
      description: payload.description,
      created_date: ic.time(),
      updated_at: Opt.None,
      status: "Created",
      due_in_minutes:
        BigInt(payload.due_in_minutes) * BigInt(60000000000) +
        BigInt(ic.time()),
    };
    taskStorage.insert(newTask.id, newTask);
    return Result.Ok<Task, string>(newTask);
  } catch (err) {
    return Result.Err<Task, string>("could not create Task:" + payload.title);
  }
}

// get Tasks
$query;
export function getTasks(): Result<Vec<Task>, string> {
  const tasks = taskStorage.values();

  if (tasks.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks found, please add one");
  }

  return Result.Ok(tasks);
}

// Get task by id
$query;
export function getTaskById(id: string): Result<Task, string> {
  return match(taskStorage.get(id), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }
      return Result.Ok<Task, string>(task);
    },
    None: () => Result.Err<Task, string>(`Task id:${id} not found`),
  });
}

// Search for Task by title or description4
$query;
export function searchTasks(searchInput: string): Result<Vec<Task>, string> {
  const lowerCaseSearchInput = searchInput.toLowerCase();
  try {
    const searchedTask = taskStorage
      .values()
      .filter(
        (task) =>
          task.title.toLowerCase().includes(lowerCaseSearchInput) ||
          task.description.toLowerCase().includes(lowerCaseSearchInput)
      );

    if (searchedTask.length === 0) {
      return Result.Err<Vec<Task>, string>(
        "No tasks found by this search query"
      );
    }

    return Result.Ok(searchedTask);
  } catch (err) {
    return Result.Err("Error finding the task");
  }
}

// Allows marking of completed task
$update;
export function completedTask(id: string): Result<Task, string> {
  return match(taskStorage.get(id), {
    Some: (task) => {
      const completeTask: Task = { ...task, status: "Completed" };
      taskStorage.insert(task.id, completeTask);
      return Result.Ok<Task, string>(completeTask);
    },
    None: () => Result.Err<Task, string>(`Task id:${id} not found`),
  });
}

// update task
$update;
export function updateTask(
  id: string,
  payload: TaskPayload
): Result<Task, string> {
  return match(taskStorage.get(id), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }
      const updatedTask: Task = {
        ...task,
        ...payload,
        due_in_minutes:
          BigInt(payload.due_in_minutes) * BigInt(60000000000) +
          BigInt(ic.time()),
        updated_at: Opt.Some(ic.time()),
      };
      taskStorage.insert(task.id, updatedTask);
      return Result.Ok<Task, string>(updatedTask);
    },
    None: () => Result.Err<Task, string>(`Task id:${id} not found`),
  });
}

// Delete a task
$update;
export function deleteTask(id: string): Result<Task, string> {
  return match(taskStorage.get(id), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }
      taskStorage.remove(id);
      return Result.Ok<Task, string>(task);
    },
    None: () => Result.Err<Task, string>(`Task id:${id} not found`),
  });
}

//Change Task Status
$update;
export function updateTaskStatus(
  payload: TaskStatusPayload
): Result<Task, string> {
  return match(taskStorage.get(payload.id), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }
      const updatedTask: Task = { ...task, status: payload.statusUpdate };
      taskStorage.insert(task.id, updatedTask);
      return Result.Ok<Task, string>(updatedTask);
    },
    None: () => Result.Err<Task, string>(`Task id:${payload.id} not found`),
  });
}

// Get Tasks by Status
$query;
export function getTasksByStatus(status: string): Result<Vec<Task>, string> {
  const tasksByStatus = taskStorage
    .values()
    .filter((task) => task.status === status);

  if (tasksByStatus.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks with this status");
  }

  return Result.Ok(tasksByStatus);
}

// get tasks past due_in_minutes due
$query;
export function getTasksPastDue(): Result<Vec<Task>, string> {
  const tasksPastDue = taskStorage
    .values()
    .filter((task) => task.due_in_minutes < ic.time());

  if (tasksPastDue.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks past due date");
  }

  return Result.Ok(tasksPastDue);
}

// UUID workaround
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
