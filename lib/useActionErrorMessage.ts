"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ActionError } from "./types";

// Server actions have no locale context, so they carry a code instead of a
// translated message and the UI resolves the text. `errors.<code>` must exist in
// every locale for each member of ActionErrorCode; without a code (an
// unclassified failure) the service's own string is the best available text.
export function useActionErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (result: ActionError) => (result.code ? t(result.code) : result.error),
    [t]
  );
}
