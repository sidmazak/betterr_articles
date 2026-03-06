"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { NewProjectModal } from "./new-project-modal";

type NewProjectContextValue = {
  openModal: () => void;
};

const NewProjectContext = createContext<NewProjectContextValue | null>(null);

export function NewProjectProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <NewProjectContext.Provider value={{ openModal }}>
      {children}
      <NewProjectModal open={open} onOpenChange={setOpen} />
    </NewProjectContext.Provider>
  );
}

export function useNewProjectModal() {
  const ctx = useContext(NewProjectContext);
  if (!ctx) {
    throw new Error("useNewProjectModal must be used within NewProjectProvider");
  }
  return ctx;
}
