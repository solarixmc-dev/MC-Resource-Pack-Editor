import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  const handleConfirm = (e: React.MouseEvent) => {
    console.log('ConfirmDialog handleConfirm called');
    e.preventDefault();
    e.stopPropagation();
    onConfirm();
    console.log('ConfirmDialog onConfirm executed');
  };

  console.log('ConfirmDialog render, open:', open);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-dark-secondary border-gray-200 dark:border-dark-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-gray-900 dark:text-dark-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600 dark:text-dark-text-secondary">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-gray-900 dark:text-dark-text">{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}