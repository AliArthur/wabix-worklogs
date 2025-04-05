import { Action, ActionPanel, Color, Form, Icon, List, LocalStorage, useNavigation } from "@raycast/api";
import { FormValidation, useForm, usePromise } from "@raycast/utils";
import { LocalRepository, Project } from "../types";
import { useState } from "react";
import { existsSync } from "fs";
import { join } from "path";

interface Props {
  project: string;
  onSubmit: () => void;
}

export function RepositoryForm({
  name,
  url,
  onSubmit,
}: {
  name: string;
  url: string;
  onSubmit: (name: string, url: string, index?: string) => void;
}) {
  const { pop } = useNavigation();
  const { itemProps, handleSubmit } = useForm<{ name: string; url: string }>({
    onSubmit: async (values) => {
      onSubmit(values.name, values.url);
      pop();
    },
    validation: {
      name: FormValidation.Required,
      url: (value) => {
        if (!value) return "URL is required";
        // Check if path exists
        if (!existsSync(value)) return "Path does not exist";

        // Check if .git folder exists
        const gitPath = join(value, ".git");
        if (!existsSync(gitPath)) return "Not a valid Git repository";
      },
    },
    initialValues: { name, url },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Add a new repository to the project. You can edit the name and URL of the repository." />
      <Form.TextField title="Repository name" placeholder="Ex: Backend" {...itemProps.name} />
      <Form.TextField title="Repository local URL" placeholder="" {...itemProps.url} />
    </Form>
  );
}

export function EditRepositories({ project: projectId, onSubmit }: Props) {
  const { push, pop } = useNavigation();
  const [repositories, setRepositories] = useState<LocalRepository[]>([]);

  const { data: project, isLoading: loadingProjects } = usePromise(
    async () => {
      const savedProjects = await LocalStorage.getItem<string>("projects");
      if (!savedProjects) return null;
      const porjects = JSON.parse(savedProjects) as Project[];

      const foundProject = porjects.find((p) => p.id === projectId);
      if (!foundProject) return null;
      return foundProject;
    },
    [],
    {
      onData: (data) => {
        setRepositories(data?.repositories || []);
      },
    },
  );

  const handleSubmit = async () => {
    if (!project) return;
    const updatedProject: Project = {
      ...project,
      repositories: repositories.filter((repo) => repo.name && repo.url),
    };

    const savedProjects = await LocalStorage.getItem<string>("projects");
    if (!savedProjects) return;

    const projects = JSON.parse(savedProjects) as Project[];
    const updatedProjects = projects.map((p) => (p.id === projectId ? updatedProject : p));

    await LocalStorage.setItem("projects", JSON.stringify(updatedProjects));

    onSubmit();
    pop();
  };

  const addRepository = (data: LocalRepository) => {
    setRepositories((prev) => [...prev, data]);
  };

  const updateRepo = (index: number, newData: LocalRepository) => {
    setRepositories((prev) => {
      const updatedRepos = [...prev];
      updatedRepos[index] = { ...updatedRepos[index], ...newData };
      return updatedRepos;
    });
  };

  const removeRepository = (index: number) => {
    setRepositories((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <List
      isLoading={loadingProjects}
      searchBarPlaceholder="Search Repositories..."
      navigationTitle="Edit Repositories"
      searchBarAccessory={
        <ActionPanel>
          <Action
            icon={{ source: Icon.PlusCircle }}
            title="Add Repository"
            onAction={() => {
              push(<RepositoryForm name="" url="" onSubmit={(name, url) => addRepository({ name, url })} />);
            }}
          />
          <Action
            icon={{ source: Icon.Upload }}
            title="Save Changes"
            onAction={handleSubmit}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
        </ActionPanel>
      }
    >
      {repositories.map((repo, index) => (
        <List.Item
          key={index}
          title={repo.name}
          subtitle={repo.url}
          actions={
            <ActionPanel>
              <Action
                title="Edit Repository"
                onAction={() =>
                  push(
                    <RepositoryForm
                      name={repo.name}
                      url={repo.url}
                      onSubmit={(name, url) => updateRepo(index, { name, url })}
                    />,
                  )
                }
                icon={{ source: Icon.Pencil }}
              />

              <Action
                icon={{ source: Icon.PlusCircle }}
                title="Add New Repository"
                onAction={() => {
                  push(<RepositoryForm name="" url="" onSubmit={(name, url) => addRepository({ name, url })} />);
                }}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
              />
              <Action
                icon={{ source: Icon.Upload, tintColor: Color.Green }}
                title="Save All Changes"
                onAction={handleSubmit}
                shortcut={{ modifiers: ["cmd"], key: "s" }}
              />
              <Action
                title="Remove Repository"
                onAction={() => {
                  removeRepository(index);
                }}
                icon={{ source: Icon.Trash, tintColor: Color.Red }}
                shortcut={{ modifiers: ["cmd"], key: "backspace" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
