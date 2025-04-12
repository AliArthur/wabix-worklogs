import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  LocalStorage,
  PopToRootType,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useForm, usePromise } from "@raycast/utils";

import { ActiveSession, Project, SessionLog, TaskType, WorkLogs } from "./types";
import { useRef } from "react";
import { formatDate } from "./utils/formatDate";
import { SelectCommits } from "./components/select-commits";
import { ManageProject } from "./components/manage-project";
import { DateTime } from "luxon";

function requiresGithubUrl(type: string): boolean {
  return ([TaskType.TASK, TaskType.BUG_FIX, TaskType.CHANGE_REQUEST] as string[]).includes(type);
}

export default function StartWork() {
  const { push } = useNavigation();
  const taskTypeDropdownRef = useRef<Form.Dropdown>(null);

  const {
    data: activeSessionData,
    isLoading: fetchingActiveSession,
    revalidate: reload,
  } = usePromise(async () => {
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
  });

  const { itemProps, values, handleSubmit } = useForm<{
    description: string;
    taskType: string;
    endSession: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>({
    onSubmit: async (values) => {
      if (!activeSessionData) {
        showToast(Toast.Style.Failure, "No active session found");
        return;
      }

      const requiresCommits = requiresGithubUrl(values.taskType);
      if (requiresCommits) {
        push(<SelectCommits project={activeSessionData.project} taskDetails={values} />);
        return;
      }

      const { session, project } = activeSessionData;
      if (!session.logs?.length) session.logs = [];

      const startTime = new Date(
        values.startDate ?? session.logs[session.logs.length - 1]?.endTime ?? session.startTime,
      );
      const endTime = new Date(values.endDate || new Date().getTime());
      const sessionLog: SessionLog = {
        projectId: project.id,
        description: values.description,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        githubUris: [],
        type: values.taskType as TaskType,
      };
      const newActiveSession: ActiveSession = {
        logs: [...session.logs, sessionLog],
        startTime: session.startTime,
        projectId: session.projectId,
      };
      if (values.endSession) {
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

  if (!activeSessionData && fetchingActiveSession) return <Detail />;
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
            target={<ManageProject project={activeSessionData.project} onSubmit={reload} />}
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
