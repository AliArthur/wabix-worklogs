import { List, ActionPanel, Action, Icon } from "@raycast/api";

export default function Command() {
  return (
    <List searchBarPlaceholder="Search worklogs..." navigationTitle="Manage Worklogs" isShowingDetail throttle>
      <List.EmptyView
        title="No Worklogs Found"
        description="You don't have any work logs yet. Start a session to begin tracking your work."
        icon={Icon.Clock}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Start a Session"
              url="raycast://extensions/aliarthur/wabix-worklogs/start-session"
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
