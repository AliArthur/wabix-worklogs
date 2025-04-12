export type LocalRepository = {
  url: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  repositories: LocalRepository[];
};

export type ActiveSession = {
  projectId: string;
  startTime: number;
};

export enum TaskType {
  CALL = "Call",
  TASK = "Task",
  BUG_FIX = "Bug Fix",
  CHANGE_REQUEST = "Change Request",
  QA = "QA",
  ADMINISTRATIVE = "Administrative",
  OTHER = "Other",
}

export type TaskLog = {
  projectId: string;
  description: string;
  startTime: number;
  endTime: number;
  type: TaskType;
  githubUris: string[];
};

export type Worklogs = Record<string, Record<string, TaskLog[]>>;
