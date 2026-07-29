"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { registerAction } from "./actions"
import PasswordInput from "@/components/PasswordInput"
import AuthLayout from "@/components/AuthLayout"

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, null)
  const t = useTranslations("register")

  return (
    <AuthLayout title={t("title")} description={t("subtitle")} formMaxWidth="md">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="storeName" className="ui-label">
            {t("storeName")}
          </label>
          <input
            id="storeName"
            name="storeName"
            type="text"
            required
            className="ui-input"
            placeholder={t("storeNamePlaceholder")}
          />
        </div>

        <div>
          <label htmlFor="ownerName" className="ui-label">
            {t("ownerName")}
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            className="ui-input"
            placeholder={t("ownerNamePlaceholder")}
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
            autoComplete="email"
            className="ui-input"
            placeholder={t("emailPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className="ui-label">
              {t("phone")}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="ui-input"
              placeholder={t("phonePlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="address" className="ui-label">
              {t("address")}
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="ui-input"
              placeholder={t("addressPlaceholder")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="ui-label">
            {t("password")}
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="ui-label">
            {t("confirmPassword")}
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        {state?.error && <p className="ui-alert-error text-center">{state.error}</p>}

        <button type="submit" disabled={pending} className="ui-btn-primary-block mt-2">
          {pending ? t("submitting") : t("submit")}
        </button>

        <p className="text-center text-sm text-muted mt-2">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-accent hover:underline underline-offset-4">
            {t("loginLink")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
