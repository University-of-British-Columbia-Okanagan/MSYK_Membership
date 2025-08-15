// ConfirmButton.tsx
import React from "react";
import { Button } from "../button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../alert-dialog";

interface ConfirmButtonProps {
  confirmTitle: string;
  confirmDescription: string;
  onConfirm: () => void;
  buttonLabel: React.ReactNode;
  buttonClassName?: string;
  disabled?: boolean;
}

export function ConfirmButton({
  confirmTitle,
  confirmDescription,
  onConfirm,
  buttonLabel,
  buttonClassName,
  disabled,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" className={buttonClassName} disabled={disabled}>
          {buttonLabel} 
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Yes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
