import { Badge } from "@/components/ui/badge";
import { statusBadgeClasses } from "@/lib/constants";
import type { LeadStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className={statusBadgeClasses[status]}>{status}</Badge>;
}
