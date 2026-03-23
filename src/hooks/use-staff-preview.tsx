import { createContext, useContext, useState, type ReactNode } from "react";

type StaffPreviewContextValue = {
  isPreviewingAsStaff: boolean;
  togglePreview: () => void;
};

const StaffPreviewContext = createContext<StaffPreviewContextValue>({
  isPreviewingAsStaff: false,
  togglePreview: () => {},
});

export function StaffPreviewProvider({ children }: { children: ReactNode }) {
  const [isPreviewingAsStaff, setIsPreviewingAsStaff] = useState(false);

  return (
    <StaffPreviewContext.Provider
      value={{
        isPreviewingAsStaff,
        togglePreview: () => setIsPreviewingAsStaff((prev) => !prev),
      }}
    >
      {children}
    </StaffPreviewContext.Provider>
  );
}

/** Returns whether the current user should be treated as admin, respecting the preview toggle */
export function useStaffPreview() {
  return useContext(StaffPreviewContext);
}
