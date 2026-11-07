import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MessageSquareText,
  Phone,
  Users,
} from "lucide-react";
import type { Channel, Status } from "../types";

export const STATUS_META: Record<
  Status,
  {
    label: string;
    shortDesc: string;
    icon: typeof Eye;
    pillCls: string;
    dotCls: string;
    accentBorderCls: string;
  }
> = {
  act: {
    label: "Act now",
    shortDesc: "Immediate clinical or readiness review required",
    icon: AlertTriangle,
    pillCls: "bg-act-bg text-act border border-act-line",
    dotCls: "bg-act-fill",
    accentBorderCls: "border-l-[3px] border-l-act-fill",
  },
  watch: {
    label: "Watch",
    shortDesc: "Reported deterioration, missing info, or overdue reply",
    icon: Eye,
    pillCls: "bg-watch-bg text-watch border border-watch-line",
    dotCls: "bg-watch-fill",
    accentBorderCls: "border-l-[3px] border-l-watch-fill",
  },
  ok: {
    label: "On track",
    shortDesc: "Stable against baseline · continue routine check-ins",
    icon: CheckCircle2,
    pillCls: "bg-ok-bg text-ok border border-ok-line",
    dotCls: "bg-ok-fill",
    accentBorderCls: "border-l-[3px] border-l-ok-fill",
  },
};

export const CHANNEL_ICON: Record<Channel, typeof Phone> = {
  text: MessageSquareText,
  phone: Phone,
  caregiver: Users,
};

const fieldBase =
  "rounded-lg border border-control-border bg-white px-3 py-1.5 text-[13.5px] text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const inputCls = `w-full ${fieldBase}`;

export const selectCls = `${fieldBase} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2.4'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8`;
