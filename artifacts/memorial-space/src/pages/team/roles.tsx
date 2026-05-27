import { Fragment } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Crown, Shield, ShieldCheck, Briefcase, Eye } from "lucide-react";
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_BADGE_COLOR,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  TEAM_ROLES,
  type Capability,
  type TeamRole,
} from "@/lib/permissions";

const ROLE_ICON: Record<TeamRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: ShieldCheck,
  manager: Shield,
  staff: Briefcase,
  viewer: Eye,
};

const CAPABILITY_GROUPS: { name: string; caps: Capability[] }[] = [
  {
    name: "Cemetery operations",
    caps: ["cemetery.view", "cemetery.edit", "burials.view", "burials.edit", "bookings.manage", "workOrders.manage"],
  },
  {
    name: "Memorial services",
    caps: ["memorials.manage", "obituaries.manage", "qrCodes.manage"],
  },
  {
    name: "Public site & marketplace",
    caps: ["publicSite.edit", "marketplace.view", "marketplace.edit"],
  },
  {
    name: "Accounting",
    caps: ["accounting.view", "accounting.edit"],
  },
  {
    name: "Team & access",
    caps: ["team.view", "team.invite", "team.manageRoles", "team.remove"],
  },
  {
    name: "Account & billing",
    caps: ["settings.edit", "billing.manage", "ownership.transfer"],
  },
];

export default function RolesPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/team">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to team
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Five built-in roles cover the typical cemetery org chart. Pick the lowest role that lets each member do their job.
          </p>
        </div>
      </div>

      {/* Role overview cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEAM_ROLES.map((role) => {
          const Icon = ROLE_ICON[role];
          const caps = ROLE_CAPABILITIES[role];
          return (
            <Card
              key={role}
              data-testid={`role-card-${role}`}
              className="hover:border-primary/40 transition-colors"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg border flex items-center justify-center ${ROLE_BADGE_COLOR[role]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{ROLE_LABELS[role]}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {caps.length} of {ALL_CAPABILITIES.length} capabilities
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permission matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permission matrix</CardTitle>
          <CardDescription>
            Detailed capability comparison. Each higher role inherits everything below it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-semibold py-3 pr-4 sticky left-0 bg-card">Capability</th>
                  {TEAM_ROLES.map((r) => (
                    <th key={r} className="text-center font-semibold py-3 px-2">
                      <Badge variant="outline" className={`${ROLE_BADGE_COLOR[r]} text-xs font-medium`}>
                        {ROLE_LABELS[r]}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITY_GROUPS.map((group) => (
                  <Fragment key={group.name}>
                    <tr className="bg-muted/30">
                      <td
                        colSpan={TEAM_ROLES.length + 1}
                        className="text-xs uppercase tracking-wide font-semibold text-muted-foreground py-2 px-3"
                      >
                        {group.name}
                      </td>
                    </tr>
                    {group.caps.map((cap) => (
                      <tr key={cap} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-3 pr-4 sticky left-0 bg-card">{CAPABILITY_LABELS[cap]}</td>
                        {TEAM_ROLES.map((role) => {
                          const has = ROLE_CAPABILITIES[role].includes(cap);
                          return (
                            <td key={role} className="text-center py-3 px-2">
                              {has ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About the Owner role</p>
              <p className="leading-relaxed">
                Every cemetery has exactly one Owner who can manage subscription billing and transfer ownership to another member. The system prevents demoting or removing the last Owner — promote another member to Owner first if you need to step down.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
