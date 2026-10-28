"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submit handler for useActionState forms that keeps what the user typed.
 * Passing the action to <form action> makes React reset the fields afterwards,
 * which loses input when the server returns a validation error.
 */
export function keepInputOnSubmit(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
