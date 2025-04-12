import { Action, ActionPanel, Form, Icon, LocalStorage, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { isAbsolute, relative, resolve } from "path";

import { execSync } from "child_process";
import { Project } from "../types";

interface Props {
  project?: Project;
  onSubmit?: () => void;
}

export function ManageProject({ project: projectData, onSubmit }: Props) {
  const { pop } = useNavigation();

  const { itemProps, handleSubmit } = useForm<{
    name: string;
    repositories: string[];
  }>({
    initialValues: {
      name: projectData?.name || "",
      repositories: projectData?.repositories.map((repo) => repo.url) || [],
    },
    validation: {
      name: FormValidation.Required,
      repositories: (value) => {
        if (!value) return "At least one repository is required";

        const errors: string[] = [];
        const normalizedPaths = value.map((repo) => resolve(repo));

        const uniquePaths = new Set(normalizedPaths);
        if (uniquePaths.size !== normalizedPaths.length) {
          errors.push("Duplicate repository paths are not allowed.");
        }

        normalizedPaths.forEach((repo) => {
          try {
            const output = execSync(`git -C "${repo}" rev-parse --is-inside-work-tree`, {
              stdio: ["ignore", "pipe", "ignore"],
            })
              .toString()
              .trim();

            if (output !== "true") {
              errors.push(`Repository at "${repo}" is not a valid Git repository.`);
            }
          } catch (e) {
            errors.push(`Repository at "${repo}" is not a valid Git repository.`);
          }
        });

        for (let i = 0; i < normalizedPaths.length; i++) {
          for (let j = 0; j < normalizedPaths.length; j++) {
            if (i === j) continue;
            const isRelative = relative(normalizedPaths[i], normalizedPaths[j]);
            if (isRelative && !isRelative.startsWith("..") && !isAbsolute(isRelative)) {
              errors.push(`Repository at "${normalizedPaths[j]}" is a subdirectory of "${normalizedPaths[i]}".`);
            }
          }
        }

        if (errors.length > 0) return errors[0];
      },
    },
    onSubmit: async (values) => {
      const project: Project = {
        id: projectData?.id ?? Math.random().toString(36).substring(2, 15),
        name: values.name,
        repositories: values.repositories.map((repo) => ({
          name: repo.split("/").pop() || "",
          url: repo,
        })),
      };

      const savedProjects = await LocalStorage.getItem<string>("projects");
      const projects = savedProjects ? JSON.parse(savedProjects) : [];
      if (projectData) {
        const index = projects.findIndex((p: Project) => p.id === projectData.id);
        if (index !== -1) projects[index] = project;
      } else {
        projects.push(project);
      }
      await LocalStorage.setItem("projects", JSON.stringify(projects));
      onSubmit?.();
      pop();
    },
  });

  return (
    <Form
      navigationTitle="Add Project"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Project" icon={Icon.SaveDocument} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Project Name" {...itemProps.name} />

      <Form.FilePicker
        title="Repositories"
        {...itemProps.repositories}
        allowMultipleSelection
        canChooseDirectories
        canChooseFiles={false}
      />
    </Form>
  );
}
