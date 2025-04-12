import { DateTime } from "luxon";

export const formatDate = (timestamp: number | string) => {
  const date = new Date(timestamp);
  return DateTime.fromJSDate(date).toFormat("HH:mm 'on' dd MMM");
};
