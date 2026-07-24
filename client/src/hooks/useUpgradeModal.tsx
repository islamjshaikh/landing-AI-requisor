import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { UpgradeModal } from "@/components/shared/UpgradeModal";

type UpgradeReason = "token_limit" | "project_limit" | "feature_locked" | "agent_access";

interface UpgradeModalContextType {
  showUpgrade: (reason?: UpgradeReason) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
  showUpgrade: () => {},
});

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>("token_limit");

  const showUpgrade = useCallback((r: UpgradeReason = "token_limit") => {
    setReason(r);
    setOpen(true);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ showUpgrade }}>
      {children}
      <UpgradeModal open={open} onClose={() => setOpen(false)} reason={reason} />
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  return useContext(UpgradeModalContext);
}
