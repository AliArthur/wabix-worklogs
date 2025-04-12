import {
  List,
  ActionPanel,
  Action,
  showToast,
  Toast,
  LocalStorage,
  closeMainWindow,
  PopToRootType,
  Icon,
  Color,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useCallback } from "react";
import { ActiveSession, Project } from "./types";
import { ManageProject } from "./components/manage-project";

export default function StartWork() {
  const { push } = useNavigation();

  const {
    data: projects,
    isLoading: loadingProjects,
    revalidate: reloadProjects,
  } = usePromise(async () => {
    const savedProjects = await LocalStorage.getItem<string>("projects");
    if (!savedProjects) return [];
    return JSON.parse(savedProjects) as Project[];
  }, []);

  const startProject = useCallback(async (project: Project) => {
    const activeSession = await LocalStorage.getItem("activeSession");
    if (activeSession) {
      await showToast(
        Toast.Style.Failure,
        "Session already active",
        "Please stop the current session before starting a new one.",
      );
      return;
    }

    const session: ActiveSession = { projectId: project.id, startTime: new Date().getTime(), logs: [] };
    await LocalStorage.setItem("activeSession", JSON.stringify(session));
    await closeMainWindow({ popToRootType: PopToRootType.Immediate });
    await showToast({ style: Toast.Style.Success, title: "Session Started" });
  }, []);

  return (
    <List
      searchBarPlaceholder="Select a project to start work"
      isLoading={loadingProjects}
      actions={
        <ActionPanel title="Settings">
          <Action.Push
            title="Add Project"
            icon={{ source: Icon.Plus, tintColor: Color.Blue }}
            target={<ManageProject onSubmit={reloadProjects} />}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
          />
        </ActionPanel>
      }
      isShowingDetail={!!projects?.length}
    >
      <List.EmptyView
        title="No Projects Found"
        description="You don't have any projects yet. Add a project to start tracking your work."
        icon={Icon.Clock}
      />
      {projects?.map((project) => (
        <List.Item
          key={project.id}
          title={project.name}
          detail={
            <List.Item.Detail
              markdown={
                project.repositories.length
                  ? `# ${project.name}\n\n## Repositories\n\n${project.repositories
                      .map((repo) => `- ${repo.name}`)
                      .join("\n")}`
                  : `# ${project.name}\n\nNo repositories added yet.`
              }
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Project ID" text={project.id} />
                  <List.Item.Detail.Metadata.Label title="Repositories" text={project.repositories.length.toString()} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel title="Project Actions">
              <Action title="Start Work Session" onAction={() => startProject(project)} icon={Icon.Play} />
              <Action.Push
                title="Add Project"
                icon={{ source: Icon.Plus, tintColor: Color.Blue }}
                target={<ManageProject onSubmit={reloadProjects} />}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
              />
              <Action
                title="Edit Project"
                onAction={() => push(<ManageProject project={project} onSubmit={reloadProjects} />)}
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
