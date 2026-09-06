import { toast } from "@/hooks/use-toast";

/**
 * Custom notification utility to replace browser alerts and confirms
 * Uses the existing toast system for notifications
 */

export function showSuccess(message: string) {
  toast({
    title: "Success",
    description: message,
    variant: "default",
  });
}

export function showError(message: string) {
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}

export function showInfo(message: string) {
  toast({
    title: "Info",
    description: message,
    variant: "default",
  });
}

export function showWarning(message: string) {
  toast({
    title: "Warning",
    description: message,
    variant: "default",
  });
}

export function showConfirm(
  title: string,
  description: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  // Create a custom confirmation toast with action buttons
  // The toast will auto-dismiss after 3 seconds with the progress bar animation
  const { dismiss } = toast({
    title: title,
    description: description,
    variant: "confirm",
    action: (
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            onConfirm();
            dismiss();
          }}
          className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            onCancel?.();
            dismiss();
          }}
          className="px-3 py-1.5 text-sm font-medium bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    ),
  });
}