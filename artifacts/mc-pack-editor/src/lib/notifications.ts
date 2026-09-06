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