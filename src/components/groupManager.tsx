"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { colorForOrder } from "~/lib/group-colors";
import { api } from "~/trpc/react";
import type { Group } from "~/types";
import { AuthenticatedLayout } from "./authenticatedLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

const GroupFormSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(50),
});
type GroupFormValues = z.infer<typeof GroupFormSchema>;

function GroupFormDialog({
  open,
  onOpenChange,
  initialName,
  onSubmit,
  isPending,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSubmit: (values: GroupFormValues) => void | Promise<void>;
  isPending: boolean;
  title: string;
}) {
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(GroupFormSchema),
    defaultValues: { name: initialName },
  });

  // Re-sync default when dialog re-opens with a different group.
  useEffect(() => {
    if (open) form.reset({ name: initialName });
  }, [open, initialName, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="group-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="e.g., BPI Savings"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="group-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableRow({
  group,
  billCount,
  disabled,
  onEdit,
  onDelete,
}: {
  group: Group;
  billCount: number;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group._id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-background flex items-center gap-3 rounded-md border p-3"
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Drag to reorder"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span
        className="inline-block size-4 rounded-full"
        style={{ backgroundColor: colorForOrder(group.order) }}
      />
      <span className="flex-1 truncate font-medium">{group.name}</span>
      <span className="text-muted-foreground text-xs">
        {billCount} {billCount === 1 ? "bill" : "bills"}
      </span>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export function GroupManager() {
  const utils = api.useUtils();
  const { data: groups, isLoading } = api.group.getAll.useQuery();
  const { data: bills } = api.bill.getAll.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);

  // Local copy used to drive optimistic reorder. Reset whenever the
  // server data changes.
  const [orderedGroups, setOrderedGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (groups) setOrderedGroups(groups);
  }, [groups]);

  const billCountByGroup = (groupId: string) =>
    (bills ?? []).filter((b) => b.groupId === groupId).length;

  const createMut = api.group.create.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
      toast.success("Group created");
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create group"),
  });

  const updateMut = api.group.update.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
      toast.success("Group updated");
      setEditing(null);
    },
    onError: (e) => toast.error(e.message || "Failed to update group"),
  });

  const deleteMut = api.group.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.group.getAll.invalidate(),
        utils.bill.getAll.invalidate(),
      ]);
      toast.success("Group deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete group"),
  });

  const reorderMut = api.group.reorder.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "Failed to reorder");
      // Roll back to server state.
      if (groups) setOrderedGroups(groups);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedGroups.findIndex((g) => g._id === active.id);
    const newIndex = orderedGroups.findIndex((g) => g._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedGroups, oldIndex, newIndex);
    setOrderedGroups(next);
    reorderMut.mutate({ orderedIds: next.map((g) => g._id) });
  };

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Groups</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            New group
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : orderedGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">No groups yet.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              Create your first group
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedGroups.map((g) => g._id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {orderedGroups.map((g) => (
                  <SortableRow
                    key={g._id}
                    group={g}
                    billCount={billCountByGroup(g._id)}
                    disabled={reorderMut.isPending}
                    onEdit={() => setEditing(g)}
                    onDelete={() => setDeleting(g)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <GroupFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialName=""
          isPending={createMut.isPending}
          title="New group"
          onSubmit={async (values) => {
            await createMut.mutateAsync(values);
          }}
        />

        <GroupFormDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          initialName={editing?.name ?? ""}
          isPending={updateMut.isPending}
          title="Edit group"
          onSubmit={async (values) => {
            if (!editing) return;
            await updateMut.mutateAsync({
              id: editing._id,
              data: { name: values.name },
            });
          }}
        />

        <AlertDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete group</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting && (
                  <>
                    Delete &lsquo;{deleting.name}&rsquo;? This will remove the
                    group from {billCountByGroup(deleting._id)}{" "}
                    {billCountByGroup(deleting._id) === 1 ? "bill" : "bills"}.
                    The bills will not be deleted.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMut.isPending}
                onClick={async () => {
                  if (deleting) {
                    await deleteMut.mutateAsync({ id: deleting._id });
                  }
                }}
              >
                {deleteMut.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthenticatedLayout>
  );
}
