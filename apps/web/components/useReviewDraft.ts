"use client";

import { useEffect, useState } from "react";
import { emptyReviewDraft, parseReviewDraft, type ReviewDraft } from "../../../lib/review-draft.mjs";

const KEY = "persona-lab.review-draft.v1";

export function useReviewDraft() {
  const [draft, setDraft] = useState<ReviewDraft>(emptyReviewDraft);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { setDraft(parseReviewDraft(sessionStorage.getItem(KEY))); }
    catch { setStorageAvailable(false); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(draft)); }
    catch { setStorageAvailable(false); }
  }, [draft, loaded]);
  function update(patch: Partial<ReviewDraft>) {
    setDraft(current => ({ ...current, ...patch }));
  }
  return { draft, update, setDraft, loaded, storageAvailable };
}
