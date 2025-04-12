import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  PopToRootType,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { ActiveSession, Project, SessionLog, TaskType, WorkLogs } from "../types";
import { useExec } from "@raycast/utils";
import { useCallback, useState } from "react";
import { formatDate } from "../utils/formatDate";
import { DateTime } from "luxon";

interface Props {
  project: Project;
  taskDetails: {
    endSession: boolean;
    description: string;
    taskType: string;
    startDate: Date | null;
    endDate: Date | null;
  };
}

type Commit = {
  hash: string;
  author: string;
  message: string;
  date: string;
  commitUrl: string;
};

export function SelectCommits({ project, taskDetails }: Props) {
  const [selected, setSelected] = useState(project.repositories[0]);
  const [selectedCommits, setSelectedCommits] = useState<Commit[]>([]);

  const endTask = useCallback(async () => {
    if (selectedCommits.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No commits selected",
        message: "Please select at least one commit before saving the worklog.",
      });
      return;
    }

    const activeSession = await LocalStorage.getItem("activeSession");
    if (!activeSession) {
      await showToast(Toast.Style.Failure, "No active session");
      return;
    }

    if (typeof activeSession !== "string") {
      await showToast(Toast.Style.Failure, "Invalid active session");
      await LocalStorage.removeItem("activeSession");
      return;
    }

    const session: ActiveSession = JSON.parse(activeSession);
    if (!session.logs?.length) session.logs = [];

    const startTime = new Date(
      taskDetails.startDate ?? session.logs[session.logs.length - 1]?.endTime ?? session.startTime,
    );
    const endTime = new Date(taskDetails.endDate || new Date().getTime());

    const sessionLog: SessionLog = {
      projectId: project.id,
      description: taskDetails.description,
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      githubUris: selectedCommits.map((commit) => commit.commitUrl),
      type: taskDetails.taskType as TaskType,
    };
    const newActiveSession: ActiveSession = {
      logs: [...session.logs, sessionLog],
      startTime: session.startTime,
      projectId: session.projectId,
    };
    if (taskDetails.endSession) {
      await LocalStorage.removeItem("activeSession");
      const worklogs = await LocalStorage.getItem<string>("worklogs");
      const worklogsObj: WorkLogs = worklogs ? JSON.parse(worklogs) : {};

      const sessionDate = DateTime.fromMillis(session.startTime).toFormat("yyyy-MM-dd");

      const newWorklogs = {
        ...worklogsObj,
        [sessionDate]: {
          ...(worklogsObj[sessionDate] || {}),
          [project.id]: [...(worklogsObj[sessionDate]?.[project.id] || []), ...newActiveSession.logs],
        },
      };

      await LocalStorage.setItem("worklogs", JSON.stringify(newWorklogs));
    } else {
      await LocalStorage.setItem("activeSession", JSON.stringify(newActiveSession));
    }
    const duration = DateTime.fromJSDate(endTime).diff(DateTime.fromJSDate(startTime), ["hours"]).toObject().hours;
    showHUD(`Session ended, ${duration?.toFixed(2)} hours`, {
      popToRootType: PopToRootType.Immediate,
      clearRootSearch: true,
    });
  }, [selectedCommits, taskDetails, project]);

  const { data: remoteData, isLoading: remoteLoading } = useExec("git", ["config", "--get", "remote.origin.url"], {
    cwd: selected.url,
    execute: !!selected,
    parseOutput: ({ stdout, stderr }) => {
      if (stderr) throw new Error(`Failed to extract remote URL: ${stderr}`);

      let url = stdout.replace(/\r?\n/g, "").trim();
      url = url.replace(/\.git(\/)?$/, "");

      if (url.startsWith("git@")) {
        url = url.replace(/^git@([^:]+):/, "https://$1/");
      } else if (url.startsWith("ssh://")) {
        url = url.replace(/^ssh:\/\/(git@)?/, "https://");
      }

      return url;
    },
  });

  const { data: commits, isLoading } = useExec(
    "git",
    ["log", "-n 150", "--pretty=format:%H|%an|%ad|%s", "--date=iso"],
    {
      cwd: selected.url,
      execute: !!selected && !!remoteData,
      parseOutput: ({ stdout, stderr }) => {
        if (stderr) throw new Error(`Failed to extract commits: ${stderr}`);

        const lines = stdout.trim().split("\n");

        const commits = lines.map((line) => {
          const [hash, author, date, ...messageParts] = line.split("|");
          const message = messageParts.join("|").trim();

          const commit = {
            hash: hash.trim(),
            author: author.trim(),
            message,
            date: date.trim(),
            commitUrl: "",
          };
          if (remoteData) {
            commit.commitUrl = `${remoteData}/commit/${hash.trim()}`;
          }

          return commit;
        });

        return commits;
      },
      onError: () => {
        showToast({
          style: Toast.Style.Failure,
          title: "Error executing git log command",
        });
      },
    },
  );

  const toggleCommit = (commit: Commit) => {
    const isSelected = selectedCommits.some((c) => c.hash === commit.hash);
    if (isSelected) {
      setSelectedCommits((prev) => prev.filter((c) => c.hash !== commit.hash));
    } else {
      setSelectedCommits((prev) => [...prev, commit]);
    }
  };

  return (
    <List
      isLoading={isLoading || remoteLoading}
      navigationTitle="Select commits"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Dropdown With Items"
          onChange={(newValue) => {
            const selectedRepository = project.repositories.find((repository) => repository.url === newValue);
            if (!selectedRepository) return;
            setSelected(selectedRepository);
          }}
        >
          {project.repositories.map((repository) => (
            <List.Dropdown.Item key={repository.name} title={repository.name} value={repository.url} />
          ))}
        </List.Dropdown>
      }
      filtering={{ keepSectionOrder: true }}
      isShowingDetail
    >
      <List.EmptyView
        title="No repositories found"
        description="Please add a repository to the project before selecting commits."
        icon={Icon.MagnifyingGlass}
      />
      {commits?.map((commit) => {
        const isSelected = selectedCommits.some((c) => c.hash === commit.hash);

        return (
          <List.Item
            key={commit.hash}
            title={formatDate(commit.date)}
            subtitle={commit.message}
            icon={{
              source: isSelected ? Icon.Checkmark : Icon.Circle,
              tintColor: isSelected ? Color.Green : Color.PrimaryText,
            }}
            actions={
              <ActionPanel>
                <Action
                  title={isSelected ? "Unselect" : "Select"}
                  icon={isSelected ? Icon.XMarkCircle : Icon.Checkmark}
                  onAction={() => toggleCommit(commit)}
                />
                <Action
                  title="Save Worklog"
                  icon={{ source: Icon.CheckRosette, tintColor: Color.Green }}
                  onAction={() => endTask()}
                />
                <Action.OpenInBrowser
                  url={commit.commitUrl}
                  title="Open Commit in Browser"
                  icon={Icon.Globe}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
                <Action.CopyToClipboard
                  content={commit.commitUrl}
                  title="Copy Commit URL"
                  icon={Icon.Clipboard}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
              </ActionPanel>
            }
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Commit" text={commit.hash} />
                    <List.Item.Detail.Metadata.Label title="Author" text={commit.author} />
                    <List.Item.Detail.Metadata.Label title="Date" text={formatDate(commit.date)} />
                    <List.Item.Detail.Metadata.Label title="Message" text={commit.message} />
                    <List.Item.Detail.Metadata.Link
                      title="Commit URL"
                      text={commit.commitUrl}
                      target={commit.commitUrl}
                    />
                    <List.Item.Detail.Metadata.Separator />

                    <List.Item.Detail.Metadata.TagList title="Task Type">
                      <List.Item.Detail.Metadata.TagList.Item text={taskDetails.taskType} color={Color.Blue} />
                    </List.Item.Detail.Metadata.TagList>
                    {taskDetails.startDate && (
                      <List.Item.Detail.Metadata.TagList title="Adjusted Start Date">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={formatDate(taskDetails.startDate.toString())}
                          color={Color.Yellow}
                        />
                      </List.Item.Detail.Metadata.TagList>
                    )}
                    {taskDetails.endDate && (
                      <List.Item.Detail.Metadata.TagList title="Adjusted End Date">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={formatDate(taskDetails.endDate.toString())}
                          color={Color.Yellow}
                        />
                      </List.Item.Detail.Metadata.TagList>
                    )}
                    <List.Item.Detail.Metadata.Label title="Description" text={taskDetails.description} />
                    <List.Item.Detail.Metadata.TagList title="End Session">
                      <List.Item.Detail.Metadata.TagList.Item
                        text={taskDetails.endSession ? "Yes" : "No"}
                        color={taskDetails.endSession ? Color.Green : Color.PrimaryText}
                      />
                    </List.Item.Detail.Metadata.TagList>
                  </List.Item.Detail.Metadata>
                }
              />
            }
          />
        );
      })}
    </List>
  );
}
