import { List, Icon, LocalStorage, Color, ActionPanel, Action } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { Project, WorkLogs } from "./types";
import { formatDate } from "./utils/formatDate";
import { DateTime } from "luxon";
import { Fragment } from "react/jsx-runtime";

export default function Command() {
  const { data: hasToken } = usePromise(async () => {
    const token = await LocalStorage.getItem("token");
    return !!token;
  });

  const { data: logs, isLoading } = usePromise(async () => {
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

      {!!logs &&
        !!projects &&
        Object.entries(logs).map(([date, prj]) => (
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
              const totalDuration = sessions.reduce(
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
                                <List.Item.Detail.Metadata.Label title="End Time" text={formatDate(session.endTime)} />
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
