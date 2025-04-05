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
