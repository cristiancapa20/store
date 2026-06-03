"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const t = useTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-brand-50 via-[#d8efff] to-brand-100 dark:from-brand-950 dark:via-brand-900 dark:to-brand-950">
      <div className="ui-shell w-full max-w-sm p-6 sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-50 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-brand-700/70 dark:text-brand-100/60 mt-1 text-sm">
            {t("subtitle")}
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-brand-800 dark:text-brand-100 mb-1.5 px-1"
            >
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="ui-input"
              placeholder={t("emailPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-brand-800 dark:text-brand-100 mb-1.5 px-1"
            >
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="ui-input"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center px-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="ui-btn-primary-block mt-2"
          >
            {pending ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  )
}
