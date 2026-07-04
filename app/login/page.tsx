"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { loginAction } from "./actions";
import PasswordInput from "@/components/PasswordInput";
import AuthLayout from "@/components/AuthLayout";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const t = useTranslations("auth");

  return (
    <AuthLayout title={t("title")} description={t("subtitle")}>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="ui-label mb-1.5">
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
          <label htmlFor="password" className="ui-label mb-1.5">
            {t("password")}
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="ui-alert-error text-center">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary-block mt-2"
        >
          {pending ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <p className="text-center text-sm text-brand-700/70 dark:text-brand-100/60 mt-6">
        {t("noAccountYet")}{" "}
        <Link href="/register" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
          {t("registerLink")}
        </Link>
      </p>
    </AuthLayout>
  )
}
