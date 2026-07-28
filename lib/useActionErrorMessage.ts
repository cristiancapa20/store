"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ActionError } from "./types";

// Authorization refusals carry a code instead of a translated message, because
// server actions have no locale context. The UI resolves the text.
export function useActionErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (result: ActionError) =>
      result.code === "unauthorized" || result.code === "forbidden"
        ? t(result.code)
        : result.error,
    [t]
  );
}
