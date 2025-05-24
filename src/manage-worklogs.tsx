import { List, Icon, LocalStorage, Color, ActionPanel, Action, Alert, confirmAlert } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { Project, WorkLogs, ActiveSession } from "./types";
import { formatDate } from "./utils/formatDate";
import { DateTime } from "luxon";
import { Fragment } from "react/jsx-runtime";
import { useCallback } from "react";

export default function Command() {
  const { data: hasToken } = usePromise(async () => {
    const token = await LocalStorage.getItem("token");
    return !!token;
  });

  const {
    data: logs,
    isLoading,
    revalidate,
  } = usePromise(async () => {
    const logs = await LocalStorage.getItem<string>("worklogs");
    if (!logs) return [];
    return JSON.parse(logs) as WorkLogs;
  }, []);

  const { data: projects, isLoading: loadingProjects } = usePromise(
    async () => {
      const savedProjects = await LocalStorage.getItem<string>("projects");
      if (!savedProjects) return [];
      return JSON.parse(savedProjects) as Project[];
    },
    [],
    { execute: hasToken },
  );

  const { data: activeSession } = usePromise(async () => {
    const activeSessionData = await LocalStorage.getItem("activeSession");
    if (!activeSessionData || typeof activeSessionData !== "string") {
      return null;
    }
    return JSON.parse(activeSessionData) as ActiveSession;
  }, []);

  const clearLogs = useCallback(async () => {
    const options: Alert.Options = {
      title: "Clear Worklogs",
      message: "Are you sure you want to clear all worklogs? This action cannot be undone.",
      primaryAction: {
        title: "Clear",
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: "Cancel",
        style: Alert.ActionStyle.Cancel,
      },
    };
    const confirmed = await confirmAlert(options);
    if (!confirmed) return;

    await LocalStorage.removeItem("worklogs");
    await revalidate();
  }, []);

  return (
    <List
      searchBarPlaceholder="Search worklogs..."
      navigationTitle="Manage Worklogs"
      isShowingDetail
      isLoading={isLoading || loadingProjects}
    >
      <List.EmptyView
        title="No Worklogs Found"
        description="You don't have any work logs yet. Start a session to begin tracking your work."
        icon={Icon.Clock}
      />

      {activeSession && projects && (
        <List.Section title="🔴 Active Session">
          {(() => {
            const project = projects.find((p) => p.id === activeSession.projectId);
            const currentTime = Date.now();
            const sessionStart = activeSession.logs?.length
              ? activeSession.logs[activeSession.logs.length - 1].endTime
              : activeSession.startTime;
            const currentDuration = DateTime.fromMillis(currentTime).diff(DateTime.fromMillis(sessionStart), [
              "hours",
              "minutes",
            ]);
            const totalSessionDuration = DateTime.fromMillis(currentTime).diff(
              DateTime.fromMillis(activeSession.startTime),
              ["hours", "minutes"],
            );

            return (
              <List.Item
                title={`${project?.name || "Unknown Project"} (Active)`}
                accessories={[
                  {
                    tag: {
                      value: `${Math.floor(currentDuration.hours)}h ${Math.floor(currentDuration.minutes)}m`,
                      color: Color.Green,
                    },
                  },
                ]}
                icon={{ source: Icon.Circle, tintColor: Color.Green }}
                detail={
                  <List.Item.Detail
                    metadata={
                      <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.TagList title="Status">
                          <List.Item.Detail.Metadata.TagList.Item text="Active Session" color={Color.Green} />
                        </List.Item.Detail.Metadata.TagList>
                        <List.Item.Detail.Metadata.TagList title="Current Task Duration">
                          <List.Item.Detail.Metadata.TagList.Item
                            text={`${Math.floor(currentDuration.hours)}h ${Math.floor(currentDuration.minutes)}m`}
                            color={Color.Orange}
                          />
                        </List.Item.Detail.Metadata.TagList>
                        <List.Item.Detail.Metadata.TagList title="Total Session Duration">
                          <List.Item.Detail.Metadata.TagList.Item
                            text={`${Math.floor(totalSessionDuration.hours)}h ${Math.floor(totalSessionDuration.minutes)}m`}
                            color={Color.Blue}
                          />
                        </List.Item.Detail.Metadata.TagList>
                        <List.Item.Detail.Metadata.Label
                          title="Session Started"
                          text={formatDate(activeSession.startTime)}
                        />
                        <List.Item.Detail.Metadata.Label title="Current Task Started" text={formatDate(sessionStart)} />
                        {activeSession.logs && activeSession.logs.length > 0 && (
                          <>
                            <List.Item.Detail.Metadata.Separator />
                            <List.Item.Detail.Metadata.Label
                              title="Completed Tasks"
                              text={`${activeSession.logs.length} task(s)`}
                            />
                            {activeSession.logs.map((log, index) => {
                              const duration = DateTime.fromMillis(log.endTime).diff(
                                DateTime.fromMillis(log.startTime),
                                ["hours", "minutes"],
                              );
                              return (
                                <Fragment key={index}>
                                  <List.Item.Detail.Metadata.TagList title={`Task ${index + 1} - ${log.type}`}>
                                    <List.Item.Detail.Metadata.TagList.Item
                                      text={`${Math.floor(duration.hours)}h ${Math.floor(duration.minutes)}m`}
                                      color={Color.Purple}
                                    />
                                  </List.Item.Detail.Metadata.TagList>
                                  <List.Item.Detail.Metadata.Label title="Description" text={log.description} />
                                </Fragment>
                              );
                            })}
                          </>
                        )}
                      </List.Item.Detail.Metadata>
                    }
                  />
                }
              />
            );
          })()}
        </List.Section>
      )}

      {!!logs &&
        !!projects &&
        Object.entries(logs)
          .sort(
            ([dateA], [dateB]) =>
              DateTime.fromFormat(dateB, "yyyy-MM-dd").toMillis() - DateTime.fromFormat(dateA, "yyyy-MM-dd").toMillis(),
          )
          .map(([date, prj]) => (
            <List.Section key={date} title={DateTime.fromFormat(date, "yyyy-MM-dd").toFormat("MMMM dd, yyyy")}>
              {Object.entries(prj).map(([projectId, sessions]) => {
                const project = projects.find((p) => p.id === projectId);
                const withDuration = sessions.map((session) => {
                  const duration = DateTime.fromMillis(session.endTime).diff(DateTime.fromMillis(session.startTime), [
                    "hours",
                    "minutes",
                  ]);
                  const formattedDuration = `${duration.hours}h ${duration.minutes.toFixed()}m`;
                  return {
                    project: project?.name || "Unknown Project",
                    duration: formattedDuration,
                    type: session.type,
                    description: session.description,
                    githubUris: session.githubUris?.length ? session.githubUris : undefined,
                  };
                });
                const totalDurationRaw = sessions.reduce(
                  (acc, session) => {
                    const duration = DateTime.fromMillis(session.endTime).diff(DateTime.fromMillis(session.startTime), [
                      "hours",
                      "minutes",
                    ]);
                    return {
                      hours: acc.hours + duration.hours,
                      minutes: acc.minutes + duration.minutes,
                    };
                  },
                  { hours: 0, minutes: 0 },
                );

                const totalDuration = {
                  hours: totalDurationRaw.hours + Math.floor(totalDurationRaw.minutes / 60),
                  minutes: totalDurationRaw.minutes % 60,
                };

                return (
                  <List.Item
                    key={`${date}-${projectId}`}
                    title={project?.name || "Unknown Project"}
                    accessories={[
                      {
                        tag: {
                          value: `${totalDuration.hours.toFixed()}h ${totalDuration.minutes.toFixed()}m`,

                          color: Color.PrimaryText,
                        },
                      },
                    ]}
                    actions={
                      <ActionPanel>
                        <Action.CopyToClipboard
                          title="Copy Worklog"
                          content={JSON.stringify(withDuration, null, 2)}
                          shortcut={{ modifiers: ["cmd"], key: "c" }}
                          icon={Icon.Clipboard}
                        />
                        <Action
                          title="Clear Worklogs"
                          style={Action.Style.Destructive}
                          onAction={clearLogs}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
                          icon={Icon.Trash}
                        />
                      </ActionPanel>
                    }
                    detail={
                      <List.Item.Detail
                        metadata={
                          <List.Item.Detail.Metadata>
                            {sessions.map((session, index) => {
                              const duration = DateTime.fromMillis(session.endTime).diff(
                                DateTime.fromMillis(session.startTime),
                                ["hours", "minutes"],
                              );
                              const formattedDuration = `${duration.hours}h ${duration.minutes.toFixed()}m`;

                              return (
                                <Fragment key={index}>
                                  <List.Item.Detail.Metadata.TagList title="Task Type">
                                    <List.Item.Detail.Metadata.TagList.Item text={session.type} color={Color.Blue} />
                                  </List.Item.Detail.Metadata.TagList>
                                  <List.Item.Detail.Metadata.TagList title="Duration">
                                    <List.Item.Detail.Metadata.TagList.Item
                                      text={formattedDuration}
                                      color={Color.Magenta}
                                    />
                                  </List.Item.Detail.Metadata.TagList>
                                  <List.Item.Detail.Metadata.Label title="Description" text={session.description} />
                                  <List.Item.Detail.Metadata.Label
                                    title="Start Time"
                                    text={formatDate(session.startTime)}
                                  />
                                  <List.Item.Detail.Metadata.Label
                                    title="End Time"
                                    text={formatDate(session.endTime)}
                                  />
                                  {!!session.githubUris?.length &&
                                    session.githubUris.map((uri, index) => (
                                      <List.Item.Detail.Metadata.Link
                                        key={index}
                                        title="Commit"
                                        text={`Commit #${index + 1}`}
                                        target={uri}
                                      />
                                    ))}
                                  <List.Item.Detail.Metadata.Separator />
                                </Fragment>
                              );
                            })}
                          </List.Item.Detail.Metadata>
                        }
                      />
                    }
                  />
                );
              })}
            </List.Section>
          ))}
    </List>
  );
}
