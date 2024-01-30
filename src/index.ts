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
  due_in_minutes: bigint;
  updated_at: Opt<nat64>;
  created_date: nat64;
  employeeId: Opt<string>;
  category: string;
}>;

type Employee = Record<{
  id: string;
  name: string;
  email: string;
}>;

type EmployeePayload = Record<{
  name: string;
  email: string;
}>;

type EmployeeTaskAssign = Record<{
  employeeId: string;
  taskId: string;
}>;

type TaskPayload = Record<{
  title: string;
  description: string;
  due_in_minutes: number;
  category: string;
}>;

type TaskStatusPayload = Record<{
  id: string;
  statusUpdate: string;
}>;

const taskStorage = new StableBTreeMap<string, Task>(0, 44, 512);
const employeeStorage = new StableBTreeMap<string, Employee>(1, 44, 512);

// Allows one to add a Task
$update;
export function addTask(payload: TaskPayload): Result<Task, string> {
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
      employeeId: Opt.None,
      category: payload.category,
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

// Add Employee
$update;
export function addEmployee(
  payload: EmployeePayload
): Result<Employee, string> {
  if (!payload.name || !payload.email) {
    return Result.Err<Employee, string>("Missing or invalid input data");
  }

  try {
    const newEmployee: Employee = {
      id: uuidv4(),
      name: payload.name,
      email: payload.email,
    };
    employeeStorage.insert(newEmployee.id, newEmployee);
    return Result.Ok<Employee, string>(newEmployee);
  } catch (err) {
    return Result.Err<Employee, string>(
      "could not create Employee:" + payload.name
    );
  }
}

// Get all Employees
$query;
export function getAllEmployees(): Result<Vec<Employee>, string> {
  const employees = employeeStorage.values();

  if (employees.length === 0) {
    return Result.Err<Vec<Employee>, string>(
      "No employees found, please add one"
    );
  }

  return Result.Ok<Vec<Employee>, string>(employees);
}

// Get Employee by id
$query;
export function getEmployeeById(id: string): Result<Employee, string> {
  return match(employeeStorage.get(id), {
    Some: (employee) => Result.Ok<Employee, string>(employee),
    None: () => Result.Err<Employee, string>(`Employee id:${id} not found`),
  });
}

// assign employee to task
$update;
export function assignEmployee(
  payload: EmployeeTaskAssign
): Result<Task, string> {
  return match(taskStorage.get(payload.taskId), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }

      const employee = employeeStorage.get(payload.employeeId);
      if (!employee) {
        return Result.Err<Task, string>(
          `Employee id:${payload.employeeId} not found`
        );
      }

      try {
        const updatedTask: Task = {
          ...task,
          employeeId: Opt.Some(payload.employeeId),
        };
        taskStorage.insert(task.id, updatedTask);
        return Result.Ok<Task, string>(updatedTask);
      } catch (error) {
        return Result.Err<Task, string>(
          "could not assign employee to task due to:" + error
        );
      }
    },
    None: () => Result.Err<Task, string>(`Task id:${payload.taskId} not found`),
  });
}

// get Tasks
$query;
export function getAllTasks(): Result<Vec<Task>, string> {
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

// Get task per employeeId
$query;
export function getTaskByEmployeeId(
  employeeId: string
): Result<Vec<Task>, string> {
  const tasks = taskStorage.values();
  const filteredTasks: Vec<Task> = [];
  tasks.forEach((task) => {
    match(task.employeeId, {
      Some: (id) => {
        if (id === employeeId) {
          filteredTasks.push(task);
        }
      },
      None: () => {},
    });
  });

  if (filteredTasks.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks found, please add one");
  }

  return Result.Ok<Vec<Task>, string>(filteredTasks);
}

// Search for Task by title or description
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

// Allows marking of completed task by the creator
$update;
export function completedTask(id: string): Result<Task, string> {
  return match(taskStorage.get(id), {
    Some: (task) => {
      if (task.creator.toString() !== ic.caller().toString()) {
        return Result.Err<Task, string>("Only authorized user can access Task");
      }

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

// get tasks by category
$query;
export function getTasksByCategory
    category: string
): Result<Vec<Task>, string> {
  const tasksByCategory = taskStorage
    .values()
    .filter((task) => task.category === category);

  if (tasksByCategory.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks in this category");
  }

  return Result.Ok(tasksByCategory);
}

// Get Tasks by Status
$query;
export function getTasksByStatus(status: string): Result<Vec<Task>, string> {
  if (!status) {
    return Result.Err<Vec<Task>, string>("Missing status input");
  }

  const tasksByStatus = taskStorage
    .values()
    .filter((task) => task.status.toLowerCase() === status.toLowerCase());

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
    .filter(
      (task) =>
        task.due_in_minutes < ic.time() &&
        task.status.toLowerCase() !== "completed"
    );

  if (tasksPastDue.length === 0) {
    return Result.Err<Vec<Task>, string>("No tasks past due date");
  }

  return Result.Ok(tasksPastDue);
}

// tasks analysis, percentage of tasks completed, percentage of tasks past due,
$query;
export function getTasksAnalysis(): string {
  const tasks = taskStorage.values();
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return "No tasks found, please add one";
  }

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed"
  ).length;
  const pastDueTasks = tasks.filter(
    (task) =>
      task.due_in_minutes < ic.time() &&
      task.status.toLowerCase() !== "completed"
  ).length;
  const percentageCompleted = ((completedTasks / totalTasks) * 100).toFixed(2);
  const percentagePastDue = ((pastDueTasks / totalTasks) * 100).toFixed(2);
  const analysis = `${percentageCompleted}% of tasks are completed, ${percentagePastDue}% of tasks are past due`;
  return analysis;
}

// employee analysis, percentage of tasks completed, percentage of tasks past due,
$query;
export function getEmployeeAnalysis(employeeId: string): string {
  const tasks = taskStorage.values();
  const filteredTasks: Vec<Task> = [];

  tasks.forEach((task) => {
    match(task.employeeId, {
      Some: (id) => {
        if (id === employeeId) {
          filteredTasks.push(task);
        }
      },
      None: () => {},
    });
  });

  const totalTasks = filteredTasks.length;

  if (filteredTasks.length === 0) {
    return "No tasks found for this employee, please add one";
  }

  const completedTasks = filteredTasks.filter(
    (task) => task.status === "Completed"
  ).length;
  const pastDueTasks = filteredTasks.filter(
    (task) =>
      task.due_in_minutes < ic.time() &&
      task.status.toLowerCase() !== "completed"
  ).length;
  const percentageCompleted = ((completedTasks / totalTasks) * 100).toFixed(2);
  const percentagePastDue = ((pastDueTasks / totalTasks) * 100).toFixed(2);
  const analysis = `${percentageCompleted}% of tasks are completed, ${percentagePastDue}% of tasks are past due`;
  return analysis;
}

// UUID workaround
globalThis.crypto = {
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
