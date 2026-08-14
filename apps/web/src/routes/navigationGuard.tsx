import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';

const UNSAVED_REVIEW_WARNING = 'Unsaved review information will be discarded.';

interface NavigationGuardContextValue {
  /** True while the current reviewer has unsaved warehouse-review form values (see `ReturnDetailsPage`). */
  isDirty: boolean;
  /** Called by the page that owns the dirty state whenever it changes — never persisted anywhere. */
  setDirty: (dirty: boolean) => void;
  /**
   * Runs `action` immediately when nothing is dirty; otherwise shows one
   * shared confirmation naming exactly what will happen before running it.
   * Both `AppShell`'s nav links and Return Details' own "Back to Returns"
   * link call this, so there is exactly one implementation of "ask before
   * leaving," not one per navigation trigger.
   */
  guardNavigation: (action: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | undefined>(undefined);

/**
 * Scoped to the authenticated shell (`AppShell` renders this around its nav
 * and `<Outlet>`), so it resets naturally on logout/login rather than
 * needing explicit teardown. Deliberately not a generic form-draft/blocking
 * framework: it tracks one boolean and shows one dialog — see
 * `docs/WEB_UX.md` §8 and root `CLAUDE.md` §13.1 for why no draft is ever
 * persisted anywhere (not here, not `localStorage`).
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const guardNavigation = useCallback(
    (action: () => void) => {
      if (isDirty) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [isDirty],
  );

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setDirty: setIsDirty, guardNavigation }}>
      {children}
      {pendingAction && (
        <ConfirmDialog
          title="Leave this return?"
          message={UNSAVED_REVIEW_WARNING}
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={() => {
            const action = pendingAction;
            setPendingAction(null);
            setIsDirty(false);
            action();
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuardContextValue {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within a NavigationGuardProvider');
  }
  return context;
}
