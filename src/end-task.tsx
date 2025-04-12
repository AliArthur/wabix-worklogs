import { Action, ActionPanel, Detail, Form, Icon, LocalStorage, showToast, Toast, useNavigation } from "@raycast/api";
import { FormValidation, useForm, usePromise } from "@raycast/utils";

import { TokenForm } from "./components/token-form";
import { ActiveSession, Project, TaskType } from "./types";
import { useRef } from "react";
import { formatDate } from "./utils/formatDate";
import { EditRepositories } from "./components/edit-repository";
import { SelectCommits } from "./components/select-commits";

function requiresGithubUrl(type: string): boolean {
  return ([TaskType.TASK, TaskType.BUG_FIX, TaskType.CHANGE_REQUEST] as string[]).includes(type);
}

export default function StartWork() {
  const { push } = useNavigation();
  const taskTypeDropdownRef = useRef<Form.Dropdown>(null);

  const {
    data: hasToken,
    isLoading: checkingToken,
    revalidate,
  } = usePromise(async () => {
    const token = await LocalStorage.getItem("token");
    return !!token;
  });

  const {
    data: activeSessionData,
    isLoading: fetchingActiveSession,
    revalidate: reload,
  } = usePromise(
    async () => {
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

      const savedProjects = await LocalStorage.getItem<string>("projects");
      if (!savedProjects) return;
      const projects = JSON.parse(savedProjects) as Project[];

      const project = projects.find((p) => p.id === session.projectId);
      if (!project) {
        await showToast(Toast.Style.Failure, "Project not found");
        await LocalStorage.removeItem("activeSession");
        return;
      }

      return { session, project };
    },
    [],
    { execute: hasToken },
  );

  const { itemProps, values, handleSubmit } = useForm<{
    description: string;
    taskType: string;
    endSession: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>({
    onSubmit: (values) => {
      if (!activeSessionData) {
        showToast(Toast.Style.Failure, "No active session found");
        return;
      }

      const requiresCommits = requiresGithubUrl(values.taskType);
      if (requiresCommits) {
        push(
          <SelectCommits
            project={activeSessionData.project}
            taskDetails={values}
            session={activeSessionData.session}
          />,
        );
        return;
      }
      console.log("Form submitted with values:", values);
    },
    initialValues: {
      taskType: TaskType.TASK,
      description: "",
      endSession: false,
      startDate: null,
      endDate: null,
    },
    validation: {
      description: FormValidation.Required,
      taskType: (value) => {
        if (!value) return "Task type is required";
        if (!Object.values(TaskType).includes(value as TaskType)) {
          return "Invalid task type";
        }
      },
    },
  });

  if (!hasToken && !checkingToken) return <TokenForm onSuccess={revalidate} />;
  if (checkingToken || fetchingActiveSession) return <Detail />;
  if (!activeSessionData) return <Detail markdown="No active session found." />;

  return (
    <Form
      searchBarAccessory={<Form.LinkAccessory target="https://wabix.io" text="Open Wabix" />}
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={requiresGithubUrl(values.taskType) ? "Continue" : "Submit"}
            icon={Icon.CheckCircle}
            onSubmit={handleSubmit}
          />
          <Action
            title="Focus Task Type"
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            icon={Icon.Circle}
            onAction={() => {
              taskTypeDropdownRef.current?.focus();
            }}
          />
          <Action.Push
            title="Edit Repositories"
            target={<EditRepositories project={activeSessionData.project.id} onSubmit={reload} />}
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        text={`${activeSessionData.project.name} | Task started at ${formatDate(activeSessionData.session.startTime)}`}
      />

      <Form.Dropdown
        {...itemProps.taskType}
        ref={taskTypeDropdownRef}
        info="Use ⌘ + T to focus"
        placeholder="Select a task type"
      >
        <Form.Dropdown.Item value={String(TaskType.TASK)} title="Task" icon={Icon.Code} />
        <Form.Dropdown.Item value={String(TaskType.BUG_FIX)} title="Bug Fix" icon={Icon.Bug} />
        <Form.Dropdown.Item value={String(TaskType.CHANGE_REQUEST)} title="Change Request" icon={Icon.EditShape} />
        <Form.Dropdown.Item value={String(TaskType.CALL)} title="Call" icon={Icon.Phone} />
        <Form.Dropdown.Item value={String(TaskType.QA)} title="QA" icon={Icon.CheckCircle} />
        <Form.Dropdown.Item value={String(TaskType.ADMINISTRATIVE)} title="Administrative" icon={Icon.Document} />
        <Form.Dropdown.Item value={String(TaskType.OTHER)} title="Other" icon={Icon.QuestionMark} />
      </Form.Dropdown>

      <Form.TextArea
        id="description"
        title="Description"
        placeholder="What did you work on?"
        enableMarkdown
        autoFocus
        info="Use ⌘ + Enter to submit"
      />

      <Form.Checkbox id="endSession" label="Close work session after task" defaultValue={false} />

      <Form.Separator />
      <Form.Description title="Optional" text="Adjust the start time or end time if needed" />
      <Form.DatePicker {...itemProps.startDate} title="Start date" />
      <Form.DatePicker {...itemProps.endDate} title="End date" />
    </Form>
  );
}
