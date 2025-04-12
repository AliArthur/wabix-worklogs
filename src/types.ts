export enum TaskType {
  CALL = "Call",
  TASK = "Task",
  BUG_FIX = "Bug Fix",
  CHANGE_REQUEST = "Change Request",
  QA = "QA",
  ADMINISTRATIVE = "Administrative",
  OTHER = "Other",
}

export type LocalRepository = {
  url: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  repositories: LocalRepository[];
};

export type SessionLog = {
  projectId: string;
  description: string;
  startTime: number;
  endTime: number;
  githubUris?: string[];
  type: TaskType;
};

export type ActiveSession = {
  projectId: string;
  startTime: number;
  logs: SessionLog[];
};

export type WorkLogs = {
  [date: string]: { [projectId: string]: SessionLog[] };
};
