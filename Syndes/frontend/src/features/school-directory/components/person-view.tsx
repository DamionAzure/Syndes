"use client";

import { UserCog } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { standaloneLink } from "@/lib/link-styles";
import { cn } from "@/lib/utils";
import {
  ACCESS_LABEL,
  accessStateOf,
  activeAssignment,
  activeEnrollment,
  classesTaughtBy,
  classLabel,
  ENROLLMENT_LABEL,
  findAccount,
  findClass,
  findSection,
  fullName,
  sectionLabel,
  timestampLabel,
} from "../directory";
import {
  assignTeacher,
  enrollLearner,
  grantTeacherAccess,
  removeAccess,
  removeLearnerFromSection,
  removeTeacherAccess,
  restoreAccess,
  unassignTeacher,
  type LeaveReason,
} from "../directory-actions";
import type { Account, Directory } from "../directory-types";
import { adminRoutes } from "../routes";
import { useDirectory } from "../use-directory";
import { AccessBadge } from "./access-badge";
import { ActionFeedback, useDirectoryAction } from "./action-feedback";
import { ClassPicker, NONE, SectionPicker } from "./pickers";

const HEADING_ID = "person-heading";

type Run = ReturnType<typeof useDirectoryAction>["run"];

function Panel({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid min-w-0 grid-cols-1 gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 id={id} className="text-section font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-[62ch] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PersonView() {
  const accountId = useSearchParams().get("account");
  const directory = useDirectory();
  const account = findAccount(directory, accountId);
  const { feedback, run } = useDirectoryAction();

  if (!account) {
    return (
      <>
        <PageHeader id={HEADING_ID} icon={UserCog} title="Account not found" />
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-muted-foreground">There is no account with this link in the school directory.</p>
          <Link href={adminRoutes.people()} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            Go to people and access
          </Link>
        </div>
      </>
    );
  }

  const state = accessStateOf(directory, account);

  return (
    <>
      <PageHeader
        id={HEADING_ID}
        icon={UserCog}
        title={fullName(account)}
        description={account.email}
        context={
          <Link href={adminRoutes.people()} className={cn(standaloneLink, "text-meta")}>
            People and access
          </Link>
        }
        actions={<AccessBadge state={state} className="h-8 px-3 text-body" />}
      />
      <ActionFeedback feedback={feedback} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-6">
          {state === "waiting" || state === "unenrolled" ? <PlacePanel directory={directory} account={account} run={run} /> : null}
          {state === "learner" ? <SectionPanel directory={directory} account={account} run={run} /> : null}
          {state === "teacher" ? <ClassesPanel directory={directory} account={account} run={run} /> : null}
          {state === "admin" ? (
            <Panel
              id="admin-heading"
              title="Administrator"
              description="Administrators give and remove access and keep the school's sections in order. Administrator access itself is changed by the school's system owner, not from this screen."
            >
              {null}
            </Panel>
          ) : null}
          {state === "removed" ? (
            <Panel
              id="removed-heading"
              title="Access removed"
              description={`Signing in gives ${account.givenName} nothing. Restoring access lets them use Learn again; Teacher access and sections have to be given again.`}
            >
              <ConfirmDialog
                trigger={<Button className="justify-self-start" />}
                triggerLabel="Restore access"
                tone="default"
                title={`Restore access for ${fullName(account)}?`}
                description="They will be able to sign in and use Learn. You can then enroll them in a section or give Teacher access."
                confirmLabel="Restore access"
                onConfirm={() => run((current, context) => restoreAccess(current, account.id, context))}
                focusAfterId={HEADING_ID}
              />
            </Panel>
          ) : null}
          {state !== "admin" && state !== "removed" ? <RemoveAllPanel account={account} run={run} canRemove={state !== "learner"} /> : null}
        </div>

        <aside aria-label="Account details" className="grid min-w-0 grid-cols-1 gap-6">
          <Panel id="details-heading" title="Account">
            <dl className="grid gap-3">
              {[
                ["Access", ACCESS_LABEL[state]],
                ["Email", account.email],
                ...(account.lrn ? [["LRN", account.lrn]] : []),
                ["First signed in", timestampLabel(account.joinedAt)],
              ].map(([term, detail]) => (
                <div key={term} className="grid gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                  <dt className="text-meta text-muted-foreground">{term}</dt>
                  <dd className="tabular-nums [overflow-wrap:anywhere]">{detail}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <HistoryPanel directory={directory} account={account} />
        </aside>
      </div>
    </>
  );
}

/** A new sign-in or a Learner without a Section: place them, or give Teacher access. */
function PlacePanel({ directory, account, run }: { directory: Directory; account: Account; run: Run }) {
  const [sectionId, setSectionId] = useState(NONE);
  return (
    <Panel
      id="place-heading"
      title="Give access"
      description={`${account.givenName} can sign in but has no section or classes. Signing in alone never grants Teacher access.`}
    >
      <div className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-border">
        <div className="grid content-start gap-3 md:pr-6">
          <h3 className="font-semibold">As a Learner</h3>
          <SectionPicker id="enroll-section" label="Section" directory={directory} value={sectionId} onChange={setSectionId} />
          <Button
            className="justify-self-start"
            disabled={sectionId === NONE}
            onClick={() => {
              const result = run((current, context) => enrollLearner(current, { learnerId: account.id, sectionId }, context));
              if (result.ok) setSectionId(NONE);
            }}
          >
            Enroll in section
          </Button>
        </div>
        <div className="grid content-start gap-3 md:pl-6">
          <h3 className="font-semibold">As a Teacher</h3>
          <p className="text-meta text-muted-foreground">
            Lets them open the Teach pages. Assign their classes next, so they see the right learners.
          </p>
          <ConfirmDialog
            trigger={<Button variant="outline" className="justify-self-start" />}
            triggerLabel="Give Teacher access"
            tone="default"
            title={`Give ${fullName(account)} Teacher access?`}
            description="They will be able to write and seal modules, and see class records for the classes you assign them. Check this is the right person before you continue."
            confirmLabel="Give Teacher access"
            onConfirm={() => run((current, context) => grantTeacherAccess(current, account.id, context))}
            focusAfterId={HEADING_ID}
          />
        </div>
      </div>
    </Panel>
  );
}

function SectionPanel({ directory, account, run }: { directory: Directory; account: Account; run: Run }) {
  const [moveTo, setMoveTo] = useState(NONE);
  const [reason, setReason] = useState<LeaveReason | null>(null);
  const enrollment = activeEnrollment(directory, account.id);
  const section = enrollment ? findSection(directory, enrollment.sectionId) : undefined;
  if (!enrollment || !section) return null;

  return (
    <Panel id="section-heading" title="Section" description={`Enrolled in ${sectionLabel(section)} since ${timestampLabel(enrollment.startedAt)}.`}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <SectionPicker
          id="move-section"
          label="Move to another section"
          directory={directory}
          value={moveTo}
          onChange={setMoveTo}
          excludeId={section.id}
        />
        <Button
          variant="outline"
          disabled={moveTo === NONE}
          onClick={() => {
            const result = run((current, context) => enrollLearner(current, { learnerId: account.id, sectionId: moveTo }, context));
            if (result.ok) setMoveTo(NONE);
          }}
        >
          Move learner
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="max-w-[48ch] text-meta text-muted-foreground">
          Removing them from the section ends their access to its classes. The reason is counted in the school&apos;s drop rate.
        </p>
        <ConfirmDialog
          trigger={<Button variant="destructive" />}
          triggerLabel="Remove from section"
          title={`Remove ${fullName(account)} from ${sectionLabel(section)}?`}
          description="Choose why they are leaving. Their records stay; only their place in the section ends."
          confirmLabel="Remove from section"
          confirmDisabled={reason === null}
          onConfirm={() => {
            if (reason) run((current, context) => removeLearnerFromSection(current, { learnerId: account.id, reason }, context));
            setReason(null);
          }}
          focusAfterId={HEADING_ID}
        >
          <div className="grid gap-2">
            <p id="leave-reason-label" className="font-medium">
              Reason
            </p>
            <RadioGroup
              aria-labelledby="leave-reason-label"
              value={reason}
              onValueChange={(value) => setReason(value === "dropped" || value === "transferred" ? value : null)}
              className="gap-2"
            >
              {(
                [
                  ["dropped", "Dropped", "Stopped attending this school year."],
                  ["transferred", "Transferred out", "Moved to another school."],
                ] as const
              ).map(([value, label, hint]) => (
                <FieldLabel
                  key={value}
                  htmlFor={`reason-${value}`}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-md border-2 border-border p-3 has-data-checked:border-primary has-data-checked:bg-surface-muted"
                >
                  <RadioGroupItem value={value} id={`reason-${value}`} className="mt-1" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{label}</span>
                    <span className="text-meta font-normal text-muted-foreground">{hint}</span>
                  </span>
                </FieldLabel>
              ))}
            </RadioGroup>
          </div>
        </ConfirmDialog>
      </div>
    </Panel>
  );
}

function ClassesPanel({ directory, account, run }: { directory: Directory; account: Account; run: Run }) {
  const [classId, setClassId] = useState(NONE);
  const classes = classesTaughtBy(directory, account.id);
  const replacing = classId !== NONE ? activeAssignment(directory, classId) : undefined;
  const replacedTeacher = replacing ? findAccount(directory, replacing.teacherId) : undefined;
  const chosen = classId !== NONE ? findClass(directory, classId) : undefined;

  function assign() {
    const result = run((current, context) => assignTeacher(current, { classId, teacherId: account.id }, context));
    if (result.ok) setClassId(NONE);
  }

  return (
    <>
      <Panel
        id="classes-heading"
        title="Classes"
        description={
          classes.length === 0
            ? `${account.givenName} has Teacher access but no classes yet, so their Teach pages are empty.`
            : `${account.givenName} sees class records only for these classes.`
        }
      >
        {classes.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table label={`Classes taught by ${fullName(account)}`}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Class</TableHead>
                  <TableHead scope="col" className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((schoolClass) => (
                  <TableRow key={schoolClass.id}>
                    <TableHead scope="row" className="text-body font-medium text-foreground">
                      {classLabel(directory, schoolClass)}
                    </TableHead>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={<Button variant="ghost" size="sm" aria-label={`Unassign from ${classLabel(directory, schoolClass)}`} />}
                        triggerLabel="Unassign"
                        title={`Unassign from ${classLabel(directory, schoolClass)}?`}
                        description={`${account.givenName} will no longer see this class's records. The class will have no teacher until you assign one.`}
                        confirmLabel="Unassign"
                        onConfirm={() => run((current, context) => unassignTeacher(current, schoolClass.id, context))}
                        focusAfterId={HEADING_ID}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <ClassPicker
            id="assign-class"
            label="Assign a class"
            directory={directory}
            value={classId}
            onChange={setClassId}
            excludeTeacherId={account.id}
          />
          {replacedTeacher && chosen ? (
            <ConfirmDialog
              trigger={<Button />}
              triggerLabel="Assign class"
              tone="default"
              title={`Replace ${fullName(replacedTeacher)}?`}
              description={`${classLabel(directory, chosen)} is taught by ${fullName(replacedTeacher)}. Assigning ${fullName(account)} ends their assignment to this class.`}
              confirmLabel="Replace teacher"
              onConfirm={assign}
              focusAfterId={HEADING_ID}
            />
          ) : (
            <Button disabled={classId === NONE} onClick={assign}>
              Assign class
            </Button>
          )}
        </div>
      </Panel>

      <Panel
        id="teacher-access-heading"
        title="Teacher access"
        description="Removing Teacher access unassigns every class above. They keep their account and can still use Learn."
      >
        <ConfirmDialog
          trigger={<Button variant="destructive" className="justify-self-start" />}
          triggerLabel="Remove Teacher access"
          title={`Remove Teacher access from ${fullName(account)}?`}
          description={`They will lose the Teach pages${classes.length ? ` and ${classes.length} ${classes.length === 1 ? "class" : "classes"} will have no teacher` : ""}. You can give access again later.`}
          confirmLabel="Remove Teacher access"
          onConfirm={() => run((current, context) => removeTeacherAccess(current, account.id, context))}
          focusAfterId={HEADING_ID}
        />
      </Panel>
    </>
  );
}

function RemoveAllPanel({ account, run, canRemove }: { account: Account; run: Run; canRemove: boolean }) {
  return (
    <Panel
      id="remove-heading"
      title="Remove all access"
      description={
        canRemove
          ? "Signing in will give them nothing: no Learn, no Teach. Use this when someone leaves the school or an account was made by mistake."
          : "Remove them from their section first and record why they left. Then you can remove all access."
      }
    >
      <ConfirmDialog
        trigger={<Button variant="destructive" className="justify-self-start" disabled={!canRemove} />}
        triggerLabel="Remove all access"
        title={`Remove all access for ${fullName(account)}?`}
        description="They will not be able to use Syndes with this account. Their records stay, and you can restore access later."
        confirmLabel="Remove all access"
        onConfirm={() => run((current, context) => removeAccess(current, account.id, context))}
        focusAfterId={HEADING_ID}
      />
    </Panel>
  );
}

function HistoryPanel({ directory, account }: { directory: Directory; account: Account }) {
  const entries = [
    ...directory.enrollments
      .filter((enrollment) => enrollment.learnerId === account.id)
      .map((enrollment) => {
        const section = findSection(directory, enrollment.sectionId);
        const where = section ? sectionLabel(section) : "A section";
        return {
          key: enrollment.id,
          at: enrollment.endedAt ?? enrollment.startedAt,
          text: enrollment.endedAt
            ? `${where}: ${ENROLLMENT_LABEL[enrollment.status].toLowerCase()}`
            : `${where}: enrolled`,
        };
      }),
    ...directory.assignments
      .filter((assignment) => assignment.teacherId === account.id)
      .map((assignment) => {
        const schoolClass = findClass(directory, assignment.classId);
        const label = schoolClass ? classLabel(directory, schoolClass) : "A class";
        return {
          key: assignment.id,
          at: assignment.endedAt ?? assignment.startedAt,
          text: assignment.endedAt ? `${label}: assignment ended` : `${label}: teaching`,
        };
      }),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <Panel id="history-heading" title="History">
      {entries.length === 0 ? (
        <p className="text-muted-foreground">No sections or classes yet.</p>
      ) : (
        <ol className="grid gap-3 border-l border-border pl-4">
          {entries.map((entry) => (
            <li key={entry.key} className="grid gap-0.5">
              <span className="text-meta text-muted-foreground tabular-nums">{timestampLabel(entry.at)}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
