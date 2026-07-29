"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createStaff, deleteStaff } from "./actions";
import PasswordInput from "@/components/PasswordInput";

type StaffRow = { id: string; name: string; email: string };

type Props = {
  staff: StaffRow[];
  canAdd: boolean;
  plan: string;
  limit: number | null;
};

export default function StaffClient({ staff, canAdd, plan, limit }: Props) {
  const t = useTranslations("staff");
  const [createState, createAction, creating] = useActionState(
    createStaff,
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(userId: string) {
    setDeleting(userId);
    await deleteStaff(userId);
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="ui-page-title">{t("title")}</h1>
          <p className="text-sm text-muted mt-1">
            {t("countLine", {
              count: staff.length,
              limit: limit !== null ? `/${limit}` : "",
              plan,
            })}
          </p>
        </div>
        {canAdd && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="ui-btn-primary shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("add")}
          </button>
        )}
      </div>

      {!canAdd && (
        <div className="ui-alert-warning">
          {t("limitReached", { limit: limit ?? 0 })}{" "}
          <span className="font-medium">{t("limitUpgrade")}</span>
        </div>
      )}

      {showForm && (
        <form
          action={createAction}
          className="ui-card space-y-4 animate-fade-in-up"
        >
          <h2 className="ui-section-title">{t("newTitle")}</h2>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="name" className="ui-label">
                {t("name")}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="ui-input"
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="email" className="ui-label">
                {t("email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="ui-input"
                placeholder={t("emailPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="password" className="ui-label">
                {t("password")}
              </label>
              <PasswordInput
                id="password"
                name="password"
                required
                placeholder={t("passwordPlaceholder")}
              />
            </div>
          </div>

          {createState?.error && (
            <p className="ui-alert-error">{createState.error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="ui-btn-primary"
            >
              {creating ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="ui-btn-secondary"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {staff.length === 0 ? (
        <div className="ui-empty">
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="ui-row flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-content truncate">
                  {member.name}
                </p>
                <p className="text-sm text-muted truncate">{member.email}</p>
              </div>
              <button
                onClick={() => handleDelete(member.id)}
                disabled={deleting === member.id}
                className="ui-btn-danger shrink-0 text-xs px-3"
              >
                {deleting === member.id ? t("deleting") : t("delete")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
