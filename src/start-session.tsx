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
import { TokenForm } from "./components/token-form";
import { EditRepositories } from "./components/edit-repository";

const mockProjects = [
  { id: "1", name: "Project Alpha" },
  { id: "2", name: "Project Beta" },
  { id: "3", name: "Project Gamma" },
];

export default function StartWork() {
  const { push } = useNavigation();
  const {
    data: hasToken,
    isLoading: checkingToken,
    revalidate,
  } = usePromise(async () => {
    const token = await LocalStorage.getItem("token");
    return !!token;
  });

  const {
    data: projects,
    isLoading: loadingProjects,
    revalidate: reloadProjects,
  } = usePromise(
    async () => {
      const savedProjects = await LocalStorage.getItem<string>("projects");
      if (!savedProjects) return [];
      return JSON.parse(savedProjects) as Project[];
    },
    [],
    { execute: hasToken },
  );

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

    const session: ActiveSession = { projectId: project.id, startTime: new Date().getTime() };
    await LocalStorage.setItem("activeSession", JSON.stringify(session));
    await closeMainWindow({ popToRootType: PopToRootType.Immediate });
    await showToast({ style: Toast.Style.Success, title: "Session Started" });
  }, []);

  if (!hasToken && !checkingToken) return <TokenForm onSuccess={revalidate} />;

  const refreshProjects = async () => {
    const mock = mockProjects.map<Project>((project) => ({ ...project, repositories: [] }));
    const savedProjects = await LocalStorage.getItem<string>("projects");
    if (savedProjects) {
      const parsedProjects = JSON.parse(savedProjects) as Project[];
      mock.forEach((project) => {
        const existingProject = parsedProjects.find((p) => p.id === project.id);
        if (!existingProject) return;
        project.repositories = existingProject.repositories;
      });
    }

    await LocalStorage.setItem("projects", JSON.stringify(mock));
    reloadProjects();
    await showToast({
      style: Toast.Style.Success,
      title: "Projects Refreshed",
      message: "The projects list has been refreshed successfully.",
    });
  };

  return (
    <List
      searchBarPlaceholder="Select a project to start work"
      isLoading={checkingToken || loadingProjects}
      actions={
        <ActionPanel title="Settings">
          <Action
            title="Refresh Projects"
            onAction={refreshProjects}
            icon={{ source: Icon.RotateClockwise, tintColor: Color.Orange }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </ActionPanel>
      }
      isShowingDetail
    >
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
              <Action
                title="Edit Repositories"
                onAction={() => push(<EditRepositories project={project.id} onSubmit={reloadProjects} />)}
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
              <Action
                title="Refresh Projects"
                onAction={refreshProjects}
                icon={{ source: Icon.RotateClockwise, tintColor: Color.Orange }}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
