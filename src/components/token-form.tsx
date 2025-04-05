import { Action, ActionPanel, Form, LocalStorage } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";

export function TokenForm({ onSuccess }: { onSuccess?: () => void }) {
  const { itemProps, handleSubmit } = useForm<{ token: string }>({
    onSubmit: async (values) => {
      // Simulate token validation
      LocalStorage.setItem("token", values.token);
      onSuccess?.();
    },
    validation: {
      token: FormValidation.Required,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Not Authenticated. Please enter your API token to authenticate." />
      <Form.TextField title="Token" placeholder="xxxx..." {...itemProps.token} />
    </Form>
  );
}
